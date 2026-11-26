Agent: reviewer

# Review: build-quiq layer-4-task-01 (SSE phòng thi + G-12), round 1

- Worktree: `E:\Quiq\.worktrees\layer-4__task-01` (branch `wt/layer-4__task-01`, base bc1dd01, thay đổi chưa commit)
- Review level: **STRICT**
- Reason: task chạm phân quyền một endpoint mới (stream có tuổi thọ dài), giữ tài nguyên lâu (listener, interval, socket), đổi lý do kết thúc attempt (G-12), sửa file dùng chung (`AppDeps`, `finalizeAttempt`, `RosterView` trong `@quiq/shared`, `createTestApp`).
- Blast radius:
  - API: `GET /api/teacher/exams/:examId/classes/:classId/stream` (mới). `GET .../roster` giờ có ghi (kiểm hết giờ lười). `POST .../close` đổi `endReason`. `finalizeAttempt` được mọi đường kết thúc gọi. `getStudentState` (`touchPresence` thêm 1 SELECT mỗi lần học sinh polling).
  - Hợp đồng chung: `RosterStudent.interrupted` (mới, bắt buộc), `ROSTER_STREAM_EVENT`, `AppDeps.realtime?`, `TestApp.realtime`.
  - Web: `useRoster`, `ControlPanel`, `RosterTable`, `ConnectionBadge`.
  - Dữ liệu: attempt `in_progress` quá `ends_at + 3s` bị nộp bởi request của giáo viên.

## Verify commands + result

Chạy lại cả 4 lệnh trong worktree, sau lần sửa comment cuối của builder:

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint không báo gì) |
| `pnpm test` | PASS: 37 test file, **430/430** test |
| `pnpm build` | PASS (exit 0) |

## Kiểm chứng những gì builder tự báo

- **Phát tín hiệu sau commit: OK.**
  - Mọi lời gọi `deps.realtime?.publish` đều nằm ngoài transaction: `finalize.ts:120`, `attempts/service.ts:139`, `class-control/service.ts:102` và `:168`, `student/service.ts:266`.
  - Diff của `finalize.ts` chỉ thêm cờ `ended` và một lần publish sau `await transaction`. Logic chấm, câu UPDATE có điều kiện `status = 'in_progress'`, và FOR UPDATE giữ nguyên.
  - Thiếu hub thì `?.` bỏ qua, không lỗi.
- **G-12: OK.**
  - `getRoster` gọi `loadOwnedExamClass` (kiểm quyền) trước, rồi mới tới `expireDueClassAttempts` (`roster.ts:81-82`).
  - Roster và thu bài cùng dùng `isPastGrace`, tức cùng hằng `ANSWER_GRACE_SECONDS` với lưu đáp án.
  - Chạy đồng thời với lưu đáp án hoặc với stream khác an toàn: có FOR UPDATE, có UPDATE có điều kiện, và chỉ phát tín hiệu khi `ended` đúng.
  - `roster-expiry.test.ts` phủ: trong dung sai vẫn `in_progress`; quá hạn thì `timeout`; khi thu bài, bài quá hạn ra `timeout`, bài còn giờ ra `closed`.
- **`touchPresence`: OK.**
  - Giữa SELECT và upsert có cửa sổ race, nhưng tệ nhất chỉ phát trùng tín hiệu, và tín hiệu trùng được gộp. Không có trường hợp mất tín hiệu.
  - Giá trị upsert y như cũ, nên presence 15 giây không đổi.
  - Test L2 vẫn xanh.
- **Hợp đồng: OK.**
  - `deps.realtime?` là tùy chọn.
  - `createTestApp` vẫn nhận `options` cũ.
  - Chữ ký `RegisterRoutes` không đổi.
  - `RosterStudent.interrupted` là field bắt buộc mới. Chỉ có web trong repo dùng, và đã cập nhật (`exams.test.tsx`).
- **Ownership: OK.** Không đụng `packages/db/**`, `docs/**`, `package.json`, lockfile hay `next.config.ts` (đối chiếu `git status`).
- **Lệch so với danh sách file trong task, chấp nhận được:**
  - Tách `roster.ts` và `test-setup.ts` mới để `service.ts` không vượt 300 dòng.
  - `attempts/start.ts` không sửa; tín hiệu "Bắt đầu" phát ở `attempts/service.ts:139`.
- **Kích thước: OK.**
  - Mọi file đổi đều ≤ 300 dòng. Lớn nhất là `student/service.ts` 294, `control-panel.tsx` 278, `class-control.test.ts` 274.
  - 0 em-dash trong các file mới.
- **Dọn tài nguyên khi đóng luồng: OK.**
  - `onClose` gắn vào cả `ctx.res` close lẫn PassThrough close, có cờ `once`. Thêm nhánh dự phòng `socket.destroyed`, cho trường hợp client rời đi trong lúc chụp ảnh đầu.
  - Hàm dọn xoá interval, huỷ đăng ký hub, và gọi `live.stop()` để xoá debounce và chặn `push`.
  - Khi `getRoster` đầu tiên lỗi thì huỷ đăng ký trước khi ném lỗi.
  - Hub xoá Set rỗng.
  - Shutdown dùng `closeAllConnections`, nên luồng SSE không treo lúc tắt server.
- **Web: OK.**
  - Mỗi lúc chỉ có một EventSource, vì chỉ `onerror` (sau `close`) mới hẹn mở lại.
  - Hàm dọn của effect đóng nguồn, polling và retry timer.
  - State khởi tạo là `EMPTY` và mọi thứ chạy trong effect, nên không lệch hydration.
  - Có test cho: SSE, fallback, retry, đổi lớp, unmount, huy hiệu Gián đoạn.

## Findings

### [MAJOR] M1: Luồng SSE không kiểm lại phiên sau khi đã kết nối; trường bị khóa, tài khoản bị tắt hoặc phiên bị thu hồi vẫn nhận roster vô thời hạn

- Vị trí:
  - `apps/api/src/modules/class-control/stream.ts:84` (`createLiveRoster(() => getRoster(deps, scope, ref), ...)`)
  - `stream.ts:97-100` (interval)
  - `stream.ts:36-38` (nhánh catch đóng luồng)
- Bằng chứng:
  - `authenticate` (`http/guards.ts:40-64`) chỉ chạy một lần, lúc mở request. Phiên là bản ghi DB có thể thu hồi (`findActiveSession`), có kiểm `staffActive` và `schoolLocked`, có trượt 8 giờ.
  - Sau đó mỗi nhịp 10 giây và mỗi tín hiệu đều chạy `getRoster` → `loadOwnedExamClass`, mà hàm này chỉ kiểm chủ bài và trường, không kiểm phiên.
  - Vì vậy nhánh catch "Mất quyền" ở `stream.ts:37` không bao giờ chạy khi mất quyền đăng nhập.
  - Luồng không có tuổi thọ tối đa, và keepalive giữ nó sống mãi.
  - Hệ quả: đăng xuất ở tab hoặc máy khác, admin tắt tài khoản, admin tổng khóa trường, hoặc phiên quá 8 giờ, thì luồng vẫn đẩy họ tên, trạng thái và điểm học sinh.
- Vi phạm FR-001: "Trường bị khóa: admin/giáo viên không đăng nhập" (`SPECIFICATIONS.md:58`). Đây cũng là phân quyền dữ liệu học sinh, rủi ro đỏ theo AGENTS.md.
- Hệ quả phụ, cần ghi rõ: trước đây polling 3 giây gia hạn phiên trượt. Khi SSE đang chạy thì không request nào gia hạn, nên giáo viên chỉ ngồi nhìn phòng thi có thể hết phiên giữa buổi.
- Cách sửa đề xuất:
  - Lúc kết nối, lưu `sessionId` từ `currentStaff(ctx)`, hoặc lưu hash token.
  - Ở mỗi nhịp `refreshMs`, hoặc ngay đầu `push`, kiểm lại đúng như `authenticate`: `findActiveSession(...)` còn hiệu lực, `staffActive`, `!schoolLocked`.
  - Không còn hợp lệ thì `channel.close()`. Client sẽ thấy `onerror`, chuyển sang polling, nhận 401 và hiện lỗi.
  - Có gia hạn phiên trong lúc kiểm hay không là quyết định của builder, nhưng phải ghi lại hành vi đã chọn. Mặc định đề xuất: không gia hạn, chỉ kiểm.
  - Thêm test: mở stream, thu hồi phiên (hoặc khóa trường), rồi luồng kết thúc trong khoảng một `refreshMs`. Harness nhịp 100ms sẵn có dùng được.

### [MINOR] m1: Test có thể chập chờn: kiểm tổng `listenerCount() === 1` trong khi luồng của test trước có thể chưa dọn xong

- Vị trí: `apps/api/src/modules/class-control/stream.test.ts:148`, cùng `afterEach` ở dòng 43-46.
- `afterEach` chỉ gọi `req.destroy()`; việc dọn phía server chạy bất đồng bộ.
- Sửa: trong `afterEach`, sau khi đóng client, chờ `await waitUntil(() => h.testApp.realtime.listenerCount() === 0, 1000)`. Hoặc kiểm `listenerCount(examClassId)` của lớp vừa tạo.

### [MINOR] m2: Bảng có thể hiện skeleton mãi nếu EventSource treo ở trạng thái CONNECTING hoặc proxy gom dữ liệu

- Vị trí: `apps/web/src/features/class-control/use-roster.ts:571-592`.
- Khi đó `onerror` không bao giờ chạy: không có polling dự phòng, huy hiệu cũng `null`.
- Spike dev đạt, nhưng môi trường deploy chưa kiểm.
- Sửa: thêm watchdog. Không có sự kiện `roster` trong khoảng N giây sau khi mở (ví dụ 5 giây), hoặc quá khoảng 2 lần `refreshMs` kể từ sự kiện cuối, thì coi như lỗi: đóng nguồn, bắt đầu polling và hẹn thử lại.

### [MINOR] m3: Không có backpressure

- Vị trí: `apps/api/src/realtime/sse.ts:32`.
- `stream.write()` bỏ qua giá trị trả về, và `setTimeout(0)` tắt timeout của socket.
- Hệ quả: client chậm, hoặc kết nối TCP nửa mở (rớt wifi), thì PassThrough đệm không giới hạn cho tới khi TCP truyền lại thất bại (khoảng phút).
- Vì mỗi sự kiện là ảnh chụp đầy đủ, sửa rẻ như sau: khi `stream.writableNeedDrain` thì bỏ qua sự kiện, hoặc chỉ giữ bản mới nhất.

### [MINOR] m4: Hai nhánh chưa có test

- Nhánh lỗi của `push`: `getRoster` ném lỗi thì luồng phải đóng (`stream.ts:36-38`).
- Đường phát tín hiệu từ kiểm hết giờ lười bên trong `getRoster` của giáo viên. Hiện chỉ có test qua đường `/api/student/state`.
- Nên bổ sung. Test cho nhánh lỗi sẽ đi cùng test của M1.

### [MINOR] m5: Không giới hạn số kết nối

- Mỗi kết nối chạy `getRoster`, gồm khoảng 4 truy vấn cộng một lượt kiểm hết giờ, mỗi 10 giây và mỗi tín hiệu.
- Mở nhiều tab là nhân tải DB. Trên HTTP/1.1, mỗi tab SSE còn chiếm 1 trong 6 kết nối cho phép trên một origin.
- Chấp nhận cho demo. Ghi gap hoặc residual risk, chưa bắt sửa.

### [NIT]

- n1: `createLiveRoster` (`stream.ts:19-69`) dài khoảng 50 dòng, sát giới hạn. Có thể tách `push` ra ngoài.
- n2: `touchPresence` thêm một SELECT cho mỗi lần học sinh polling 3 giây. Chấp nhận được. Có thể gộp bằng `RETURNING` với `xmax` hoặc CTE, nhưng không bắt buộc.
- n3: Nhánh "trình duyệt không có EventSource" (`use-roster.ts:591`) chưa có test web.

## Mutation suy luận

| Mutation | Có test bắt không |
|---|---|
| Bỏ publish ở `dispatchClass`, `touchPresence`, `startAttempt`, `finalizeAttempt`, `closeClass` | Có: `stream.test.ts:97-122`. `refreshMs` 600 giây nên chỉ tín hiệu mới có thể làm test qua. |
| Bỏ dọn listener hoặc interval | Có: `stream.test.ts:141-160` |
| Bỏ kiểm quyền stream (401/404) | Có: `stream.test.ts:72-95` |
| Bỏ kiểm hết giờ lười trên roster, hoặc đảo `timeout`/`closed` | Có: `roster-expiry.test.ts` |
| Kiểm lại phiên trên stream | Code chưa có (M1), nên cũng không có test |

## Responsive Checklist Gate

Project có `ui:` (breakpoints 375/768/1280). Diff đụng UI nhưng chỉ thêm một hàng huy hiệu `flex justify-end` và một span `flex items-center gap-2` trong ô bảng. Task ghi "chỉ desktop" cho màn phòng thi. Không có browser, nên tôi kiểm bằng cách đọc CSS.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Không cuộn ngang | OK (phần diff) | Huy hiệu là inline-flex, nội dung ngắn, không đặt độ rộng cố định |
| Mobile-first, grid auto-fit | N/A, ngoài scope | `grid-cols-4` của KPI có từ trước (L3), không thuộc diff; nếu cần thì đề xuất task riêng |
| Container không dùng px cố định | OK | Không thêm width hay px |
| Typography rem, clamp | OK | Dùng component `Badge` có sẵn, không thêm font-size |
| Spacing theo scale | OK | `gap-2` là token Tailwind |
| Media | N/A | Không có ảnh hay video |
| Touch target ≥ 44px | N/A | Huy hiệu không tương tác được |
| Nav mobile | N/A | Không đổi nav |
| Bảng có wrapper cuộn hoặc card | N/A, ngoài scope | Bảng có từ trước; diff chỉ thêm huy hiệu trong ô |
| 100vh, reduced-motion, overflow:hidden | OK | Diff không dùng cái nào |
| A11y | OK | Vùng huy hiệu có `aria-live="polite"` |

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` chưa cài (`command not found`, exit 127) |
| oxlint (anti-slop) | skip, oxlint chưa cấu hình (không có `.oxlintrc*` hay `oxlint.json`); eslint PASS |
| ocr (open-code-review) | skip: `ocr` v1.14.4 có cài nhưng provider trả 429 (hết quota Gemini free tier), không có finding nào. Không chặn PASS. |
| AI-readable | OK: đếm được 1 indicator (một hàm sát 50 dòng), dưới ngưỡng 3. Tên rõ ràng, comment giải thích lý do chứ không mô tả code làm gì, không có số ma thuật (`DEFAULT_REALTIME_TIMING`, `SSE_RETRY_MS`, `ROSTER_POLL_MS`). README/ARCHITECTURE: xem Doc-Impact. |
| ai-friendly-web | N/A: màn nội bộ cho giáo viên đã đăng nhập |
| blitzstrike | skip: không có môi trường được phép chạy (không được dựng server ở cổng 3000/4000/4100). M1 phát hiện qua đọc code. |

## Doc-Impact (dispatcher làm ở close-out; trailer KHÔNG được ghi `none`)

- `docs/API_SPEC.md`:
  - Endpoint `GET .../classes/:classId/stream`: guard, 401/404 trả JSON, header, `event: roster` với dữ liệu là `RosterView`, keepalive comment, gộp tín hiệu khoảng 250ms, nhịp khoảng 10 giây.
  - `RosterStudent.interrupted`.
  - `GET .../roster` giờ có thể nộp bài quá hạn (`timeout`).
  - `POST .../close` gán `endReason` là `timeout` hoặc `closed`.
  - Hành vi phiên của stream sau khi sửa M1.
- `docs/DESIGN.md`: hub một tiến trình, các điểm phát tín hiệu sau commit, luồng client SSE → polling → thử lại sau 10 giây.
- `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`:
  - G-12 chuyển resolved.
  - Gap mới: hub chỉ chạy trong một tiến trình (nhiều instance thì chỉ còn polling dự phòng).
  - Gap mới, tùy chọn: không giới hạn số kết nối SSE (m5).

## Residual risk

- Độ trễ spike qua rewrite Next (builder báo tối đa 6 ms) tôi không kiểm chứng được, vì không được chạy server. Proxy của Next dev có timeout im lặng mặc định khoảng 30 giây; keepalive 10 giây nằm dưới ngưỡng đó. Môi trường deploy (nén, nginx) chưa kiểm.
- Kết nối nửa mở và đệm không giới hạn (m3); không giới hạn số kết nối (m5).
- Hub một tiến trình: nhiều instance thì chỉ có polling dự phòng, độ trễ 3 giây.

## Verdict

**FAIL**: còn 1 MAJOR (M1: stream không kiểm lại phiên, trường khóa hoặc phiên thu hồi vẫn nhận dữ liệu). Builder sửa M1 kèm test. m1 và m4 nên sửa cùng lúc vì rẻ. m2, m3, m5 sửa hoặc ghi gap tùy dispatcher.
