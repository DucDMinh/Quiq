Agent: reviewer

# Review: build-quiq layer-4-task-01 (SSE phòng thi + G-12), round 2

- Worktree: `E:\Quiq\.worktrees\layer-4__task-01` (branch `wt/layer-4__task-01`, base bc1dd01, thay đổi chưa commit)
- Review level: **STRICT**
- Reason: round 1 FAIL vì phân quyền (M1). Lần sửa chạm `http/guards.ts`, file guard dùng chung cho mọi route cán bộ. Endpoint là kết nối sống lâu, giữ listener, interval và socket. Có thêm backpressure ở tầng SSE và watchdog ở hook web dùng chung của màn phòng thi.
- Blast radius:
  - `apps/api/src/http/guards.ts`: chỉ thêm export `createSessionCheck`. `authenticate`, `requireRole`, `requireTenant` và `currentStaff` không đổi (diff chỉ có phần thêm, dòng 67-81).
  - `GET .../classes/:classId/stream`: mỗi lần đẩy (tín hiệu hub, hoặc nhịp `refreshMs`) thêm 1 truy vấn `findActiveSession`.
  - `realtime/sse.ts`: thêm writer có ngưỡng đệm, `onOverflow` gọi destroy.
  - Web `use-roster.ts` (`startRosterFeed`): thêm watchdog, ảnh hưởng `ControlPanel`.

## Verify commands + result (chạy lại trong worktree)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint không báo gì) |
| `pnpm test` | PASS: 38 file, **439/439** test (32.7 giây) |
| `pnpm build` | PASS (Next build xong, 13 route) |

## Bảng đóng finding round 1

| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| **[MAJOR] M1**: stream không kiểm lại phiên | **ĐÃ ĐÓNG** | Xem chi tiết bên dưới |
| [m1] test `listenerCount` chập chờn | ĐÃ ĐÓNG | `stream.test.ts:46-50`: `afterEach` đóng client rồi `waitUntil(listenerCount() === 0)`. Mỗi describe dùng app và hub riêng (`useHarness`). |
| [m2] EventSource treo thì skeleton mãi | ĐÃ ĐÓNG | `use-roster.ts:91-106`. Test `class-control.test.tsx:163-191` dùng fake timer, có kiểm biên `ms - 1` và `ms`. |
| [m3] không backpressure | ĐÃ ĐÓNG | `sse.ts:20-35` và `:55-58`. Test `sse.test.ts`. |
| [m4] thiếu test nhánh lỗi push và tín hiệu G-12 từ `getRoster` | ĐÃ ĐÓNG | Nhánh lỗi: `stream.test.ts:178-183` (chuyển bài cho giáo viên khác, `loadOwnedExamClass` ném 404, luồng đóng, listener về 0). G-12: `stream.test.ts:128-138`, chạy trong describe có `refreshMs` 600 giây, nên sự kiện chỉ có thể đến từ publish trong `getRoster` của giáo viên. |
| [m5] không giới hạn số kết nối | Chuyển gap (dispatcher ghi) | Không chặn. Lần kiểm phiên làm tải mỗi kết nối tăng thêm 1 truy vấn mỗi lần đẩy. |
| n1 `createLiveRoster` sát 50 dòng | Còn (NIT) | `stream.ts:21-71`: 51 dòng tính cả chữ ký và dấu đóng, thân hàm 49 dòng. Không đổi so với round 1. |

### M1: kiểm chi tiết

**Logic `createSessionCheck`** (`guards.ts:72-81`) khớp với `authenticate` (`guards.ts:40-65`):
- Dùng cùng `findActiveSession(db, hash, clock.now())`. Hàm này lọc `isNull(revokedAt)` và `gt(expiresAt, now)` (`auth/service.ts:82`).
- Kiểm cùng `staffActive` và `!schoolLocked`.
- Kiểm thêm `session.sessionId === sessionId`, với `sessionId` lấy từ `currentStaff(ctx)` lúc mở.
  - Trên thực tế phép so này gần như thừa: hash token đã xác định đúng một phiên.
  - Vì vậy trường hợp đăng nhập lại được chặn nhờ token cũ bị thu hồi, không phải nhờ phép so `sessionId`.
- Hash token tính một lần lúc mở. Thiếu token thì trả `false`.
- Không gọi `extendSession` hay `setSessionCookie`, nên không ghi cookie và không gia hạn. Luồng SSE cũng không thể ghi header sau khi đã mở.

**Từng trường hợp:**

| Trường hợp | Kết quả | Bằng chứng |
|---|---|---|
| Đăng xuất | OK | `revokeSession` đặt `revokedAt`. Test `stream.test.ts:157-164`. |
| Đăng xuất rồi đăng nhập lại | OK (suy luận từ code) | Luồng cũ giữ hash của token cũ. Token cũ đã thu hồi, nên `findActiveSession` trả null và luồng đóng. Phiên mới có token khác, không cứu luồng cũ. Cơ chế giống hệt test thu hồi phiên; chưa có test riêng cho chuỗi đăng xuất rồi đăng nhập. |
| Tài khoản bị tắt | OK theo code | Kiểm `staffActive`. **Chưa có test riêng** (xem m6). |
| Trường bị khóa | OK | Test `:166-170`. `getRoster` không kiểm khóa trường, nên test này chỉ qua được nhờ lần kiểm phiên. |
| Quá 8 giờ | OK | Test `:172-176`. |

**Đường đóng luồng:**
- `loadIfAuthorized` ném `UNAUTHENTICATED` (`stream.ts:90-93`). Catch trong `push` gọi `channel.close()`, tức `stream.end()`. Sau đó `res` và PassThrough phát `close`, chạy `onClose` (`stream.ts:111-116`): `clearInterval`, `unsubscribe`, `live.stop()` (xoá debounce, đặt `stopped`).
- Nếu interval chạy giữa lúc end và lúc close, `comment` gặp `writableEnded` nên bỏ qua. Lần push trong hàng đợi thì ném lỗi lần nữa, và `close()` gọi lại vô hại.
- `expectClosedCleanly` kiểm cả `stream.ended()` phía client và `listenerCount() === 0`.

**Hợp đồng guards cũ:** còn nguyên. Diff `guards.ts` chỉ thêm, test auth và guards cũ xanh trong 439/439.

**Ảnh chụp đầu** (`stream.ts:99`) không qua lần kiểm phiên. Chấp nhận được, vì `authenticate` vừa chạy ngay trước đó trong cùng request.

### Client khi luồng bị server đóng (mục 2)

- Server kết thúc luồng, EventSource gọi `onerror`, dẫn tới `fallBack` (`use-roster.ts:81-89`): đóng nguồn, hiện huy hiệu "Đang kết nối lại", bật polling.
- `GET roster` qua `authenticate`:
  - Phiên hỏng hoặc tài khoản tắt trả 401. `api-client.ts:125` phát `quiq:unauthenticated`, `use-session.ts:21` hiện dialog hết phiên. **OK.**
  - Trường bị khóa trả **403 `SCHOOL_LOCKED`**, không phải 401, nên **không có dialog**.
    - `useRoster` giữ roster cũ và đặt `error`. `control-panel.tsx:81` hiện `Alert tone="danger"` với thông báo khóa trường, bên dưới là bảng ảnh chụp cuối (đã đứng yên) và huy hiệu "Đang kết nối lại".
    - Không lộ dữ liệu mới, vì server từ chối mọi request.
    - Comment `stream.ts:88-89` gộp hai trường hợp, đọc như cả hai đều hiện dialog (xem m7).

### Watchdog web (mục 3)

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| Không có 2 EventSource cùng lúc | OK | Chỉ `fallBack` hẹn `openStream`, và chỉ khi `source === stream`. Ngay sau đó `source = null`, nên `onerror` hay watchdog muộn của nguồn cũ thoát sớm. Có một biến `watchdog` chung, mỗi lần arm thì clear lần trước. |
| Không polling song song khi SSE sống | OK | `poller.stop()` chạy ở mỗi sự kiện `roster`. Polling chỉ còn trong lúc nguồn mới đang CONNECTING. Test `:139-141`. |
| Dọn khi đổi lớp hoặc unmount | OK | Hàm dọn `:111-117` đóng nguồn, dừng poller, clear retry timer và watchdog. Test `:145-161`. |
| Không vòng lặp mở/đóng | OK | Nhịp cố định: mỗi 10 giây mở lại một lần (`SSE_RETRY_MS`), đóng sau tối đa 5 giây. Không có backoff, nhưng cũng không có lặp dồn dập. |
| 25 giây > nhịp 10 giây của server | OK | Nhịp `refreshMs` gọi `live.signal()`, nên server đẩy sự kiện `roster` (không chỉ comment) khoảng mỗi 10 giây. Watchdog được arm lại ở mỗi sự kiện `roster`. Với keepalive dạng comment, EventSource không phát sự kiện nào, nên dùng `roster` làm nhịp là đúng. |

### Backpressure (mục 4)

- Ngưỡng 1 MB đo bằng `writableLength` của **PassThrough**, không phải của `res`.
- Đệm thật tối đa xấp xỉ 1 MB, cộng ~16 KB đệm phía đọc của PassThrough, cộng đệm của `res` và socket. Đó là giới hạn trên đủ dùng: luồng pipe dừng khi `res` báo nghẽn, nên phần dồn nằm ở phía ghi của PassThrough. Tôi chấp nhận cách đo này.
- `stream.destroy()` phát `close`, nên `onClose` (cờ `once`) dọn interval, listener và debounce. `ctx.res.destroy()` cắt socket.
- Không còn ghi sau khi destroy: có cờ `overflowed`, và kiểm `destroyed` / `writableEnded`.
- Test `sse.test.ts:6-19` kiểm: gọi một lần, sau ngưỡng thì không ghi thêm.
- Đường nối `onOverflow` → destroy → `onClose` chưa có test tích hợp. Suy luận từ code thì đúng, xem Residual risk.

### Mutation suy luận (mục 5)

| Mutation | Có test bắt không |
|---|---|
| Bỏ `sessionStillValid()` trong `loadIfAuthorized` | Có: test thu hồi phiên, khóa trường, quá 8 giờ đều treo tới timeout, vì `getRoster` không phụ thuộc phiên. |
| Bỏ kiểm `schoolLocked` hoặc `revokedAt` trong check | Có: các test tương ứng. |
| Bỏ kiểm `staffActive` | **Không**: chưa có test (m6). |
| Lần kiểm gọi thêm `extendSession` | **Không**: đồng hồ giả đứng yên trong các nhịp 100 ms trước `advance`, nên gia hạn chỉ đặt `expiresAt = t0 + 8h`. Sau `advance`, phiên vẫn hết hạn. Tên test "KHÔNG tự gia hạn phiên" (`:172`) nói quá những gì test kiểm (m6). |
| Bỏ dọn listener hoặc interval ở `onClose` | Có: `expectClosedCleanly`, `afterEach`, và test `:202-221`. |
| Bỏ watchdog đầu hoặc watchdog im | Có: `class-control.test.tsx:163-191`. |
| Bỏ `poller.stop()` khi có sự kiện | Có: `:139-141`. |
| Bỏ cờ `overflowed` | Có: `sse.test.ts:16-18`. |

- Test server dùng server HTTP thật, luồng SSE thật và đồng hồ giả cho thời gian DB.
- Test web dùng `vi.useFakeTimers` và FakeEventSource.
- Không còn chỗ đếm `listenerCount` tổng khi luồng của test trước chưa dọn xong.

### Hồi quy round 1 (mục 6)

- Publish chỉ sau commit: OK. Các chỗ gọi vẫn ở `finalize.ts:120` (sau transaction `:99`), `attempts/service.ts:139`, `class-control/service.ts:102` và `:168`, `student/service.ts:266`. Cùng số dòng với round 1.
- `finalize.ts`: không có thay đổi mới so với round 1 (chỉ cờ `ended` và publish).
- G-12 và `touchPresence`: không đổi. Test `roster-expiry` và test L2 xanh.
- `deps.realtime?`: vẫn tùy chọn. `stream.ts:85` và `:96` có fallback.
- Kích thước file (đếm bằng Grep): mọi file đổi ≤ 300 dòng. Lớn nhất: `student/service.ts` 294, `control-panel.tsx` 278, `class-control.test.ts` 274, `stream.test.ts` 222.
- Kích thước hàm: `startRosterFeed` 46 dòng, `openRosterStream` 42 dòng, `createSessionCheck` 10 dòng. `createLiveRoster` xem n1.
- Em-dash: 0 trong `realtime/**`, `class-control/**`, `guards.ts`, `sse-client.ts`.
- Ownership: OK. `git status` không có `packages/db`, `docs`, `package.json`, lockfile hay `next.config.ts`.

## Findings mới

### [MINOR] m6: Test phiên chưa phủ tài khoản bị tắt, và test "không tự gia hạn" không kiểm đúng điều nó tuyên bố

- Vị trí: `apps/api/src/modules/class-control/stream.test.ts:172-176`. Chưa có test `staffActive = false`.
- Sửa đề xuất:
  - Thêm test đặt tài khoản giáo viên thành không hoạt động, rồi kiểm luồng đóng.
  - Cho test 8 giờ kiểm thẳng sau vài nhịp: `sessions.expiresAt` giữ nguyên giá trị lúc mở. Hoặc tiến đồng hồ từng bước nhỏ hơn 8 giờ, qua nhiều nhịp, rồi mới vượt mốc.
- Không chặn: code đúng khi đọc, chỉ thiếu lưới bắt mutation.

### [MINOR] m7: Comment ở `stream.ts:87-89` nói SCHOOL_LOCKED cũng hiện dialog hết phiên, trong khi thực tế chỉ 401 mới hiện

- Thực tế với 403 `SCHOOL_LOCKED`:
  - `api-client.ts:125` chỉ phát sự kiện với 401.
  - Giáo viên thấy `Alert` đỏ ở `control-panel.tsx:81`, bên dưới là bảng ảnh chụp cuối đã đứng yên.
- Sửa đề xuất: chỉnh comment cho đúng. Ghi hành vi này vào `docs/API_SPEC.md` hoặc `docs/DESIGN.md` ở close-out.

### [NIT]

- n4: Sau khi phiên hỏng, client vẫn polling (401 hoặc 403) mỗi 3 giây và thử lại SSE mỗi 10 giây. Chỉ là tải nhỏ. Có thể dừng feed khi nhận `UNAUTHENTICATED` hoặc `SCHOOL_LOCKED`.
- n1 (còn lại): `createLiveRoster` 51 dòng tính cả chữ ký và dấu đóng.

## Responsive Checklist Gate

Lần sửa round 2 ở web chỉ đụng logic hook (`use-roster.ts`), không đổi markup hay CSS. Các mục giữ nguyên kết quả round 1:

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Không cuộn ngang | OK (phần diff) | Round 2 không thêm markup |
| Mobile-first, grid auto-fit | N/A, ngoài scope | `grid-cols-4` của KPI có từ L3 |
| Container không dùng px cố định | OK | Không thêm width |
| Typography rem, clamp | OK | Không thêm font-size |
| Spacing theo scale | OK | Không đổi |
| Media | N/A | Không có ảnh hay video |
| Touch target ≥ 44px | N/A | Không thêm phần tử tương tác |
| Nav mobile | N/A | Không đổi nav |
| Bảng có wrapper cuộn hoặc card | N/A, ngoài scope | Bảng có từ trước |
| 100vh, reduced-motion, overflow:hidden | OK | Diff không dùng cái nào |

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip: chưa cài (round 1: `command not found`). Không chạy lại, theo Loop Guard. |
| oxlint (anti-slop) | skip: oxlint chưa cấu hình. eslint PASS. |
| ocr (open-code-review) | skip: round 1 provider trả 429. Không chạy lại. Không chặn PASS. |
| AI-readable | OK: 1 indicator (hàm 51 dòng), dưới ngưỡng 3. Hằng có tên (`SSE_FIRST_EVENT_MS`, `SSE_STALL_MS`, `MAX_BUFFERED_BYTES`). Comment giải thích lý do. m7 là một comment sai, không phải comment mô tả code làm gì. |
| ai-friendly-web | N/A: màn nội bộ cho giáo viên đã đăng nhập |
| blitzstrike | skip: không có môi trường được phép (không được dựng server). M1 được xác minh bằng test tích hợp trên server thật trong vitest. |

## Doc-Impact (dispatcher làm ở close-out; trailer KHÔNG được ghi `none`)

- `docs/API_SPEC.md`, endpoint `GET .../classes/:classId/stream`:
  - Guard; 401/404 trả JSON; các header; `event: roster` với dữ liệu là `RosterView`; keepalive comment; gộp tín hiệu khoảng 250 ms; nhịp khoảng 10 giây.
  - **Mỗi lần đẩy kiểm lại phiên, KHÔNG gia hạn.** Phiên bị thu hồi hoặc hết hạn, tài khoản tắt, trường khóa thì server đóng luồng. Hệ quả: chỉ mở SSE không giữ phiên sống quá 8 giờ.
  - Đệm quá 1 MB thì cắt kết nối.
  - Thêm `RosterStudent.interrupted`.
  - `GET roster` có thể nộp bài quá hạn (`timeout`). `POST close` gán `endReason` là `timeout` hoặc `closed`.
- `docs/DESIGN.md`:
  - Hub một tiến trình; các điểm publish sau commit.
  - Luồng client: SSE → watchdog (5 giây chờ sự kiện đầu, 25 giây im) → polling 3 giây → thử lại SSE sau 10 giây.
  - Khi phiên hỏng: 401 hiện dialog; 403 `SCHOOL_LOCKED` hiện Alert trên màn phòng thi.
- `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`:
  - G-12 chuyển resolved.
  - Gap mới: hub chỉ chạy trong một tiến trình.
  - Gap mới: không giới hạn số kết nối SSE (m5).

## Residual risk

- Đường nối `onOverflow` → destroy → `onClose` chỉ được kiểm bằng đọc code và unit test của writer. Không có test tích hợp với socket bị nghẽn thật.
- Không kiểm được qua proxy hay deploy thật (rewrite của Next, nginx, nén) vì không được chạy server. Watchdog giảm rủi ro skeleton treo.
- Ba điểm mới chỉ được xác minh bằng đọc code: tài khoản bị tắt, đăng xuất rồi đăng nhập lại, và việc không gia hạn phiên (m6).
- Mỗi kết nối thêm 1 truy vấn phiên mỗi lần đẩy; không giới hạn số kết nối (m5); hub một tiến trình.

## Verdict

**PASS**: M1 đã đóng, có test tích hợp trên luồng thật, và các test này bắt được mutation bỏ lần kiểm phiên. m1 tới m4 đã đóng. Không còn CRITICAL hay MAJOR. Còn m6, m7 (MINOR) và các NIT, có thể sửa sau hoặc ở close-out, không chặn.
