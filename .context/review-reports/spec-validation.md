# Spec Validation Report

**Agent:** spec-validator
**Mode:** Spec validation (pre-plan), **round 2/2** (round 1 = FAIL, 6 ⚠️; report round 1 bị ghi đè bởi file này)
**Entry Mode:** partial_docs
**Sources validated against:** `docs/BRD.md` (canonical, v1.0, 2026-11-25) + mục `## Clarifications` C-01..C-09 của `SPECIFICATIONS.md` (quyết định chủ dự án duyệt trực tiếp, ghi đè BRD khi khác nhau — KHÔNG flag "spec ≠ BRD" ở các điểm này). `.context/doc-index.json`: `docs/DESIGN.md`, `API_SPEC.md`, `ERD.md`, `PERMISSION.md`, `BRIEF.md` là template non-canonical → bỏ qua. Không có code, không có `spec/changes/*.md`. `.context/project-config.md` còn là template mặc định (chưa brainstorm).
**Đối tượng:** `SPECIFICATIONS.md` (spec_version 1.0.0, bản có Clarifications + Assumptions)

> BRD có **45 FR** (FR-001..005, 010..018, 020..024, 030..039, 040..047, 050..051, 060..065) và **18 BR**; khoảng trống số là cách đánh số theo module.

## Verdict: ✅ PASS (round 2/2)

Đếm: **❌ 0 · ⚠️ 1 (MEDIUM, G-1 = BRD-issue #3 chưa có Clarification) · HIGH conflict: 0**. Ngưỡng FAIL (≥1 ❌ / HIGH / ≥3 ⚠️) không bị chạm. Nếu tính thêm lệch câu chữ Roles/FR (G-2) thành ⚠️ thì = 2, vẫn <3 → verdict không đổi.

## Round-1 ⚠️ re-check (6 mục)

| # | Mục round 1 | Nguồn đóng | Kết quả round 2 | Ghi chú |
|---|---|---|---|---|
| 1 | FR-014 (snapshot phát đề theo lớp) | C-04 + FR-014 (dòng 65) | ✅ Resolved | "mỗi lớp giữ giá trị tại thời điểm lớp đó được phát đề (C-04)"; khớp FR-033/BR-006 |
| 2 | FR-043 (thi tiếp / gián đoạn / mất lượt) | C-02, C-03 | ⚠️ Một phần | #2 (thi tiếp vs làm mới) và #4 (mất/hết lượt) đã đóng. **#3 chưa đóng** → G-1 |
| 3 | FR-045 (60s, phòng chờ, ai chỉnh) | C-03, C-06 + FR-045 (dòng 96) | ✅ Resolved (phần còn lại thuộc G-1; lệch câu chữ "chỉnh được" thuộc G-2) | Có "quay về phòng chờ rồi bấm Bắt đầu làm bài" |
| 4 | FR-063 (năm trước chỉ điểm) | C-05 | ✅ Resolved | Quyết định rõ: bảng điểm/Excel năm cũ hiện họ tên + mã; ẩn ngày sinh/quê quán/địa chỉ/người giám hộ. Câu chữ FR-063 chưa đồng bộ → G-2 |
| 5 | Regulatory (lược 2 điểm) | NFR dòng 176 | ✅ Resolved | Có (a) trẻ ≥7 tuổi cần đồng ý của trẻ + người đại diện; (b) dữ liệu nhạy cảm cần phân quyền/quy trình/bảo mật — khớp BRD dòng 338, 340 |
| 6 | Assumptions (lược 3 điểm) | `## Assumptions` | ✅ Resolved | 8 mục; BRD Assumptions (dòng 346–351) chép đủ, gồm: người ngoài lớp xem điểm (mục 4), mã do admin cấp đúng người (mục 3), thoát >60s = gián đoạn + giới hạn số lần là biện pháp chặn duy nhất (mục 8) |

Bổ sung tùy chọn đã làm: câu "quay về phòng chờ" (FR-045); câu cho phép bổ sung số liệu (FR-003) — khớp BRD.

## Trả lời các câu hỏi kiểm tra cụ thể của caller

| Câu hỏi | Kết luận | Bằng chứng |
|---|---|---|
| C-03 ("thi tiếp" vs FR-043) | **Nhất quán** | Thân FR-043 (dòng 94) không còn "thi tiếp": "máy mới bắt đầu lần mới từ đầu"; FR-045 (dòng 96): "quay về phòng chờ rồi bấm Bắt đầu làm bài… giữ nguyên bộ câu, đảo thứ tự". Khớp C-03. FR-043 không nhắc "qua phòng chờ" nhưng không mâu thuẫn |
| C-06 (thiết lập thứ ba) vs Roles / Admin trường | **KHÔNG hoàn toàn nhất quán** (lệch câu chữ, không lệch nghĩa) | FR-014 (dòng 65) đã có đủ 3 thiết lập. Nhưng bảng Roles dòng "Admin trường" (dòng 45) chỉ ghi "thiết lập số lần làm bài/cảnh báo" — thiếu ngưỡng gián đoạn; FR-045 (dòng 96) vẫn ghi "**60 giây** (chỉnh được)" không nêu ai chỉnh/ở đâu (BRD-issue #5 chỉ được đóng ở Clarifications + FR-014). → G-2 |
| Còn Firebase/Firestore sót lại? | **Không có trong phần mô tả hệ thống.** Chỉ còn: C-01 (lý do, dòng 28), Tech Stack dòng 143 ("thay Firestore"), Open Question #3 (dòng 207, đã đổi sang Supabase), dòng "Đã giải quyết (C-01)" (dòng 209). | Grep `Firebase|Firestore|Blaze|Cloud Storage`: 4 dòng, đều là ngữ cảnh lịch sử/giải thích. **Một chỗ lỗi thời:** câu dẫn Tech Stack (dòng 137) "Chỉ ghi những gì BRD (mục Constraints) đã chốt" nay sai, vì dòng Cơ sở dữ liệu (Supabase) đến từ C-01 chứ không phải BRD |
| Constraints "free-only" vs Supabase | **Nhất quán** | Supabase có gói miễn phí; Deployment (dòng 201) vẫn "chỉ hạ tầng miễn phí"; giới hạn gói (dung lượng, tự tạm dừng) là `[cần xác nhận]` + Open Question #3 hoãn có chủ ý. Tôi không xác minh độc lập điều khoản gói miễn phí Supabase hay tuyên bố Blaze của Firebase (không tra web) |

## Feature Coverage Matrix

(Đầy đủ 71 dòng; dòng **đổi so với round 1** có dấu ◆.)

### Functional Requirements

| # | Requirement | Source | Status | Notes |
|---|---|---|---|---|
| 1 | FR-001 Tạo/khóa trường | BRD Module 1; C-09 ◆ | ✅ | C-09: trường khóa vẫn tra cứu điểm cũ (FR-064), không thi được — tương thích "không đăng nhập/tổ chức thi"; thân FR-001 chưa nêu (S-1) |
| 2 | FR-002 Tạo tài khoản + reset mật khẩu admin trường | BRD Module 1 | ✅ | |
| 3 | FR-003 Thống kê tổng hợp ◆ | BRD Module 1 | ✅ | Đã thêm câu cho phép bổ sung số liệu (không đụng dữ liệu riêng/nhạy cảm) |
| 4 | FR-004 Admin tổng không truy cập dữ liệu trường | BRD Module 1 | ✅ | |
| 5 | FR-005 Admin tổng thêm trực tiếp vào DB | BRD Module 1 | ✅ | |
| 6 | FR-010 Tạo GV, 1 môn cố định, không đổi | BRD Module 2 | ✅ | |
| 7 | FR-011 Nhập danh sách HS (8 cột), mã duy nhất/trường | BRD Module 2 | ✅ | Định dạng file `[cần xác nhận]` (chờ brainstorm). E-1: mã đã vô hiệu (C-09) khi nhập |
| 8 | FR-012 Lớp theo năm, lên lớp, giữ lịch sử ◆ | BRD Module 2; C-09 | ✅ | Chuyển trường = xóa dữ liệu trường cũ + nhập mới trường mới; không chuyển giữa 2 trường (C-09) — nhất quán BR-003/FR-016 |
| 9 | FR-013 Phân công GV–lớp–năm | BRD Module 2 | ✅ | |
| 10 | FR-014 Thiết lập chung (3 thiết lập; snapshot theo lớp) ◆ | BRD Module 2; C-04, C-06 | ✅ (round 1 ⚠️) | Số lần (3), cảnh báo (2), ngưỡng gián đoạn (60s); chốt riêng từng lớp lúc phát đề |
| 11 | FR-015 Admin trường xem (không sửa) câu hỏi/đề/điểm | BRD Module 2 | ✅ | |
| 12 | FR-016 Xóa tay dữ liệu cá nhân HS ◆ | BRD Module 2; C-09 | ✅ | Mã vô hiệu không cấp lại ↔ BR-003 nhất quán (S-3: giữ tombstone mã) |
| 13 | FR-017 Admin trường xem toàn bộ thông tin HS | BRD Module 2 | ✅ | |
| 14 | FR-018 Quản lý môn ◆ | BRD Module 2; C-08 | ✅ | Không xóa môn đang có GV/câu hỏi/bài thi gắn; thân FR chưa nêu (S-1) |
| 15 | FR-020 Tạo câu hỏi bằng gõ web; Word = làm sau | BRD Module 3 | ✅ | |
| 16 | FR-021 Ảnh trong câu hỏi; công thức = làm sau ◆ | BRD Module 3; C-01 | ✅ | Lưu ảnh `[cần xác nhận]` (dự kiến Supabase Storage); xung đột Blaze đã giải quyết bằng C-01 |
| 17 | FR-022 Một/nhiều đáp án đúng | BRD Module 3 | ✅ | |
| 18 | FR-023 Mức độ khó | BRD Module 3 | ✅ | |
| 19 | FR-024 Ngân hàng riêng từng GV | BRD Module 3 | ✅ | |
| 20 | FR-030 Rút ngẫu nhiên; một bộ/bài thi; sao chép nội dung; thiếu câu → lỗi | BRD Module 4 | ✅ | |
| 21 | FR-031 Thời gian làm bài (phút) | BRD Module 4 | ✅ | |
| 22 | FR-032 Gán lớp; mã bài thi duy nhất + link | BRD Module 4 | ✅ | E-3 (lớp ngoài phân công) |
| 23 | FR-033 Phòng chờ + phát đề theo lớp | BRD Module 4 | ✅ | |
| 24 | FR-034 Đóng/thu bài theo lớp (3 nhánh) | BRD Module 4 | ✅ | |
| 25 | FR-035 Realtime trạng thái | BRD Module 4 | ✅ | Cơ chế `[cần xác nhận]` |
| 26 | FR-036 Trộn thứ tự câu + đáp án | BRD Module 4 | ✅ | |
| 27 | FR-037 Công bố đáp án theo lớp | BRD Module 4 | ✅ | |
| 28 | FR-038 Công bố bảng điểm theo lớp | BRD Module 4 | ✅ | |
| 29 | FR-039 Sửa đáp án sau thi, chấm lại | BRD Module 4 | ✅ | |
| 30 | FR-040 Vào bằng mã bài thi/link + mã HS | BRD Module 5 | ✅ | |
| 31 | FR-041 Đồng hồ riêng; giờ máy chủ | BRD Module 5 | ✅ | |
| 32 | FR-042 Quay lại sửa/nhảy câu | BRD Module 5 | ✅ | |
| 33 | FR-043 Một mã một bài; đẩy máy; ghi log ◆ | BRD Module 5; C-02, C-03 | ⚠️ (round 1 ⚠️; còn 1 điểm) | #2, #4 đã đóng. **G-1**: cùng máy quay lại trong 60s vs "đăng nhập lần 2" (dòng 94 vs 96) |
| 34 | FR-044 Cảnh báo rời tab; số lần admin đặt | BRD Module 5 | ✅ | Giá trị theo snapshot lớp (C-04) |
| 35 | FR-045 Làm lại khi gián đoạn ◆ | BRD Module 5; C-02, C-03, C-06 | ✅ (round 1 ⚠️) | Đã có "quay về phòng chờ…"; C-02 (lần cuối bị gián đoạn → hết quyền; không cấp thêm lượt) khớp. G-1 liên quan; câu chữ "chỉnh được" → G-2 |
| 36 | FR-046 Hiện điểm lần vừa làm + "Xem đáp án" ◆ | BRD Module 5; C-07 | ✅ | Thu bài thuộc nhóm hoàn thành (FR-045 đã liệt kê) → thấy điểm + "Xem đáp án"; thân FR-046 nên nêu (S-1) |
| 37 | FR-047 "Xem đáp án" luôn hiện; thông báo lỗi | BRD Module 5 | ✅ | |
| 38 | FR-050 Điểm = đúng/tổng × 10, 2 số lẻ | BRD Module 6 | ✅ | |
| 39 | FR-051 Sai không trừ; bỏ trống/đúng một phần = sai | BRD Module 6 | ✅ | |
| 40 | FR-060 GV chỉ xem lớp + môn + năm được phân công | BRD Module 7 | ✅ | |
| 41 | FR-061 Điểm từng HS, thống kê câu sai, bảng điểm lớp ◆ | BRD Module 7; C-05 | ✅ | Năm cũ vẫn hiện họ tên + mã (C-05) |
| 42 | FR-062 Xuất Excel ◆ | BRD Module 7; C-05 | ✅ | Excel năm cũ hiện họ tên + mã (C-05) |
| 43 | FR-063 GV xem thông tin cá nhân lớp phụ trách ◆ | BRD Module 7; C-05 | ✅ (round 1 ⚠️) | Quyết định rõ ở C-05; **lệch câu chữ**: thân FR-063 (dòng 108) vẫn "Lớp năm học trước: chỉ xem điểm, không xem thông tin cá nhân" → G-2 |
| 44 | FR-064 Tra cứu điểm ◆ | BRD Module 7; C-09 | ✅ | Trường khóa vẫn tra cứu được (C-09) |
| 45 | FR-065 GV xem nhật ký vi phạm + đẩy máy | BRD Module 7 | ✅ | |

### Business Rules

| # | Rule | Source | Status | Notes |
|---|---|---|---|---|
| 46 | BR-001 Bài đã nộp không sửa (trừ FR-039) | BRD BR | ✅ | |
| 47 | BR-002 Không xóa đề đã có người thi | BRD BR | ✅ | |
| 48 | BR-003 Mã HS duy nhất/trường; mã bài thi duy nhất toàn hệ thống | BRD BR; C-09 ◆ | ✅ | Nhất quán với "mã vô hiệu không cấp lại" |
| 49 | BR-004 Một mã một bài; máy 2 đẩy máy 1 | BRD BR | ✅ | Liên quan G-1 |
| 50 | BR-005 Số lần tối đa (3); chỉ làm lại khi gián đoạn | BRD BR; C-04 | ✅ | Nhỏ: "nộp hoặc hết giờ" hẹp hơn FR-045 (thu bài/tự nộp vi phạm) — đã thống nhất ở FR-045/C-07 |
| 51 | BR-006 Phát đề/thu bài riêng từng lớp | BRD BR | ✅ | |
| 52 | BR-007 Đồng hồ từ lúc Bắt đầu | BRD BR | ✅ | |
| 53 | BR-008 Điểm bằng nhau, thang 10, 2 số lẻ | BRD BR | ✅ | |
| 54 | BR-009 Cảnh báo theo số admin đặt (2) | BRD BR | ✅ | |
| 55 | BR-010 Công bố đáp án / bảng điểm riêng | BRD BR | ✅ | |
| 56 | BR-011 GV xem theo lớp/môn/năm | BRD BR | ✅ | |
| 57 | BR-012 Tài khoản do cấp trên cấp | BRD BR | ✅ | |
| 58 | BR-013 Tra cứu không thông tin cá nhân | BRD BR | ✅ | |
| 59 | BR-014 Lớp không được gán → không vào | BRD BR | ✅ | |
| 60 | BR-015 Admin tổng không vào dữ liệu trường | BRD BR | ✅ | |
| 61 | BR-016 Người giám hộ chỉ admin trường + GV phụ trách | BRD BR | ✅ | |
| 62 | BR-017 Mỗi GV đúng một môn | BRD BR | ✅ | |
| 63 | BR-018 Lớp gắn năm học, giữ lịch sử | BRD BR | ✅ | |

### Roles, NFR, Constraints, Scope, Assumptions

| # | Requirement | Source | Status | Notes |
|---|---|---|---|---|
| 64 | 4 vai trò; bảng quyền ◆ | BRD User Roles; C-06 | ⚠️ nhẹ (G-2, không tính vào đếm) | Dòng "Admin trường" thiếu "ngưỡng gián đoạn" (C-06) — nghĩa vẫn rõ nhờ FR-014 + điều khoản ưu tiên |
| 65 | NFR (8 hạng mục) | BRD NFR | ✅ | |
| 66 | NFR Privacy/Regulatory ◆ | BRD Constraints | ✅ (round 1 ⚠️) | Đủ 3 văn bản + 2 điểm trước đây bị lược + FR-016 |
| 67 | Constraints: Technical, Budget (free-only), Timeline ◆ | BRD Constraints; C-01 | ✅ | Technical đã đổi sang Supabase theo C-01 (spec khác BRD có chủ ý, không flag); free-only nhất quán. Câu dẫn Tech Stack lỗi thời (G-2) |
| 68 | Scope In/Out/Làm sau | BRD Scope | ✅ | |
| 69 | Assumptions ◆ | BRD Assumptions | ✅ (round 1 ⚠️) | 8 mục, đủ 3 điểm bị lược |
| 70 | Open Questions (3) ◆ | BRD Open Questions | ✅ ghi nhận | Mục 3 đã đổi sang Supabase; hoãn có chủ ý, không tính |
| 71 | Success Metrics [CHƯA XÁC ĐỊNH] | BRD Business Context | ✅ | |

**Tổng round 2:** ✅ 69 · ⚠️ 1 tính (#33 / G-1) + 1 nhẹ không tính (#64 / G-2) · ❌ 0.

## Gaps còn lại

### [PARTIAL] G-1 — Đổi máy vs "quay lại trong 60 giây" (BRD-issue #3, chưa có Clarification) — ⚠️ MEDIUM (tính vào đếm)
- **FR-043 (dòng 94) + BR-004 + Authentication (dòng 161):** đăng nhập máy 2 → máy 1 bị đăng xuất ngay; bài ở máy cũ = 1 lần gián đoạn (mất lượt).
- **FR-045 (dòng 96):** "Quay lại trong 60s → làm tiếp bài cũ, đồng hồ không dùng, không mất lượt."
- Chưa rõ: HS mất mạng/reload/đóng tab rồi nhập lại mã trên **cùng máy** trong 60s là "đăng nhập lần 2" (tự đẩy mình, mất lượt) hay "quay lại" (làm tiếp)? Phân biệt "cùng máy" bằng gì (Tech Stack "cơ chế phiên" đang `[cần xác nhận]`)? Mã bị khóa bao lâu sau khi mất mạng?
- Không phải ❌: hai hành vi đã nêu; thiếu quy tắc phân biệt, hợp lý chốt ở brainstorm (cơ chế phiên) nhưng nên thành requirement hành vi trước khi chia task Module 5.
- Hành động: xác nhận "cùng trình duyệt/thiết bị trong ngưỡng = làm tiếp; máy/trình duyệt khác = đẩy máy (mất lượt)". Task liên quan: FR-043, FR-045, BR-004, session/heartbeat.

### [PARTIAL] G-2 — Câu chữ thân spec chưa đồng bộ với Clarifications (không tính ⚠️; **không chặn verdict, nhưng nên sửa trước `/graph`**)
Điều khoản ưu tiên của `## Clarifications` làm nghĩa không còn mơ hồ nên đây là Suggestion; tuy nhiên graph/builder thường đọc dòng FR chứ không đọc bảng Clarifications nên rủi ro lập kế hoạch sai:
- Roles "Admin trường" (dòng 45): thiếu ngưỡng gián đoạn (C-06).
- FR-045 (dòng 96): "60 giây (chỉnh được)" không nêu ai chỉnh/ở đâu → ghi "admin trường chỉnh, FR-014".
- FR-063 (dòng 108): "không xem thông tin cá nhân" cho lớp năm trước ↔ C-05 (vẫn hiện họ tên + mã).
- FR-018 (C-08), FR-016/FR-012/FR-001/FR-064 (C-09), FR-043 (C-03: qua phòng chờ), FR-046 (C-07): chưa trích Clarification trong thân.
- Tech Stack câu dẫn (dòng 137) lỗi thời: "Chỉ ghi những gì BRD (mục Constraints) đã chốt" — dòng Supabase đến từ C-01.

## Cross-Document Conflicts

| Conflict | Source A | Source B | Impact |
|---|---|---|---|
| (không có giữa spec và BRD sau khi áp dụng Clarifications) | SPECIFICATIONS.md | docs/BRD.md | — |
| Khác biệt có chủ ý (Firestore→Supabase; thiết lập thứ ba FR-014; C-02..C-09) | Clarifications | BRD Constraints/FR-014/043/045/063… | Không flag (đã duyệt); đồng bộ BRD sau qua `/change` |
| `.context/project-config.md` `db_tool: none`, `migration_required: false` (dòng 38–39) | project-config (mặc định template) | SPECIFICATIONS.md Database Schema: Postgres, migration gate áp dụng | **MEDIUM — vận hành**: nếu brainstorm không đổi, migration-safety gate trong AGENTS.md bị tắt âm thầm trên dự án Postgres. Không phải lỗi spec |

Template docs (`PERMISSION.md`, `ERD.md`, `API_SPEC.md`, `DESIGN.md`): ERD mẫu Postgres/Prisma và PERMISSION mẫu USER/ADMIN sẽ mâu thuẫn nếu không bị ghi đè — dọn ở design/graph.

Mâu thuẫn nội bộ spec mới do Clarifications: **không có** (đã soát C-01..C-09 ↔ FR-014/018/043/045/046/063/064/016/012/001, Tech Stack, Database, Deployment, Assumptions, Open Questions).

## Missing Edge Cases (không tính verdict)
- **E-1** FR-011: nhập mã đã bị vô hiệu (C-09: không cấp lại) → phải báo lỗi; chưa nêu. Còn thiếu: định dạng file, lỗi một phần dòng, trùng mã.
- **E-2** Ảnh (FR-021/030/BR-002): sao chép hay tham chiếu; xóa ảnh ngân hàng có vỡ đề cũ; giới hạn định dạng/dung lượng; quyền truy cập ảnh.
- **E-3** FR-032: gán bài thi cho lớp ngoài phân công GV/sai năm học (GV không xem kết quả, FR-060); hai GV cùng môn cùng lớp.
- **E-4** C-02: "hoãn, thi lại lúc khác" cần cơ chế (đề/lượt mới?) vì lượt tính theo bài thi — tránh ngầm yêu cầu "cấp thêm lượt" đã loại. HS bị gián đoạn rồi lớp bị thu bài: có thấy điểm không (C-07 chỉ nêu tự nộp do thu bài).
- **E-5** Lưu đáp án khi mất kết nối/hết giờ (theo từng lần chọn hay lúc nộp) — quan trọng cho FR-041/045.
- **E-6** Chống dò mã/rate limit (FR-040/064); chính sách mật khẩu/phiên/khóa tài khoản; đồng thời (2 admin; FR-039 vs đang nộp); múi giờ; thông báo lỗi tiếng Việt (chỉ có mẫu FR-047).
- **E-7** C-09 trường bị khóa: bài đang dở/"Xem đáp án" xử lý thế nào; chỉ nêu tra cứu điểm cũ.

## Non-functional Gaps
- **Bảo mật khi chuyển Supabase:** NFR "đáp án chỉ ở máy chủ" ⇒ trình duyệt không truy cập trực tiếp Supabase (anon key) với bảng đề/đáp án; mọi truy cập qua Koa. Database Schema ghi "school_id / RLS" nhưng xác thực do Koa tự làm (không Supabase Auth) — RLS chỉ hiệu quả nếu thiết kế định danh (claims/service role + lọc ở Koa). Chốt ở brainstorm.
- **Giới hạn gói miễn phí Supabase** (dung lượng, tự tạm dừng, băng thông Storage, realtime/connection) vs heartbeat + realtime + lưu đáp án — chưa kiểm tra (Open Question #3, hoãn có chủ ý).
- **Audit:** chỉ có nhật ký vi phạm + đẩy máy; không audit thao tác admin (FR-016, reset mật khẩu, khóa trường) — liên quan Regulatory.
- Performance/Scalability/Accessibility/Availability: BRD nêu rõ không yêu cầu → không phải gap.

## Suggestions (không tính vào Verdict)
- **S-1** Đồng bộ câu chữ theo G-2 khi `/change` đồng bộ BRD (hoặc ngay trước `/graph`).
- **S-2 Database:** snapshot C-04/C-06 nên lưu (số lần, số cảnh báo, ngưỡng) trên `ExamClassAssignment` tại thời điểm phát đề.
- **S-3** "Mã vô hiệu không cấp lại" (C-09) → giữ bản ghi mã (tombstone) để ràng buộc duy nhất còn hiệu lực.
- **S-4 Mục `[cần xác nhận]` chờ brainstorm (không tính ❌/⚠️):** định dạng file nhập HS; Supabase Storage cho ảnh; realtime (SSE/WebSocket/Supabase Realtime); cơ chế phiên; cấu trúc repo/package manager/UI lib; host Koa miễn phí + CI/CD; schema + endpoint; giới hạn gói Supabase. **Khi brainstorm ghi `.context/project-config.md` phải đặt `db_tool` ≠ none và `migration_required: true`.**
- **S-5 Quy trình:** header spec ghi "KHÔNG chỉnh sửa thủ công — qua /change" nhưng spec vừa được sửa tay; `spec_version`/`updated_at` chưa bump. Sau PASS để `spec-publisher` phát hành (bump + `spec/updates/` + test-scope); cập nhật footer "Validation: vòng 2 = PASS".
- **S-6** Dọn doc template ở design/graph.
- Open Questions BRD (3 mục) chỉ ghi nhận, hoãn có chủ ý.

## Verdict Reasoning
- ❌ Missing: **0** — 45 FR + 18 BR + Roles + NFR + Constraints + Scope + Assumptions (8) + Regulatory (đủ 2 điểm) đều có.
- ⚠️ Ambiguous: **1** (G-1) <3. Năm trong sáu ⚠️ round 1 đã đóng (FR-014, FR-045, FR-063, Regulatory, Assumptions); FR-043 còn đúng điểm #3.
- Quy tắc áp dụng: thân văn bản lệch sau một Clarification là Suggestion, vì mục `## Clarifications` khai báo rõ quyền ưu tiên và mỗi quyết định đủ chính xác. Đếm G-2 thành ⚠️ cũng chỉ = 2 (<3). **G-2 không chặn verdict nhưng chặn chất lượng lập kế hoạch** — nên sửa trước `/graph`.
- HIGH conflict: **0** — Issue #1 (Blaze vs free-only) đóng bằng C-01; Supabase gói miễn phí không xung đột free-only (giới hạn gói là Open Question hoãn có chủ ý).
- Clarifications tự nhất quán: C-03 ↔ FR-043/045 ✅; C-06 ↔ FR-014 ✅ nhưng Roles + FR-045 lệch câu chữ (G-2); C-05 ↔ FR-061/062 ✅, FR-063 lệch câu chữ (G-2); C-07 ↔ FR-045/046 ✅; C-08/C-09 ↔ FR-018/016/012/001/064/BR-003 ✅; C-02 ↔ FR-043/045/Assumptions ✅.
- Kết luận: **PASS (round 2/2)** → sang brainstorm; mang theo G-1, G-2, S-4 (db_tool) làm đầu vào.

---
*Generated by: spec-validator (read-only; không sửa SPECIFICATIONS.md, BRD hay code)*
