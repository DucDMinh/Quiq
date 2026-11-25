---
spec_version: 1.0.0
updated_at: 2026-11-25
source: docs/BRD.md (v1.0, 2026-11-25, đã được chủ dự án duyệt)
---

# SPECIFICATIONS.md — Quiq

<!--
  Dựng từ docs/BRD.md (greenfield — repo chưa có code, nên KHÔNG dùng /spec-init reverse-engineer).
  ID FR-xxx / BR-xxx giữ nguyên như BRD để đối chiếu 1-1. Mục [cần xác nhận] sẽ được chốt ở bước brainstorm.
  KHÔNG chỉnh sửa thủ công sau này — thay đổi đi qua `/change` (agent change-request).
-->

## Overview

**Quiq** là web thi trắc nghiệm trực tuyến dùng chung cho **nhiều trường** (multi-tenant, dữ liệu mỗi trường tách riêng). Giáo viên ra đề từ ngân hàng câu hỏi riêng, học sinh/sinh viên làm bài có giới hạn thời gian bằng mã (không tài khoản), hệ thống tự chấm điểm thang 10.

Mục tiêu: giảm thời gian chấm bài, chống gian lận, cho phép thi từ xa. Success metrics: **[CHƯA XÁC ĐỊNH — chủ dự án chưa cần đo]**.
Trạng thái: chạy local trên máy chủ dự án, chưa triển khai, chưa chạy thật. Giao diện **tiếng Việt**, **chỉ máy tính** (không mobile).

## Clarifications (chủ dự án trả lời 2026-11-25 — GHI ĐÈ BRD khi khác nhau)

> Trả lời cho 9 vấn đề validator vòng 1 nêu ra. `docs/BRD.md` là intent doc nên tôi không sửa; spec này ưu tiên hơn BRD ở các điểm dưới. Cần đồng bộ lại BRD thì chạy `/change`.

| ID | Điểm | Quyết định |
|---|---|---|
| C-01 | Nền dữ liệu (thay Firestore + Firebase Storage; BRD Constraints/Technical) | **Chuyển sang Supabase** (Postgres). Lý do: Cloud Storage for Firebase nay bắt buộc gói Blaze, xung đột "chỉ hạ tầng miễn phí". Chi tiết (Supabase Storage cho ảnh? vẫn Koa tự xác thực?) chốt ở brainstorm. |
| C-02 | FR-043/045: đẩy máy hoặc gián đoạn mất 1 lượt; đang ở lần cuối thì hết quyền thi | **Giữ nguyên như BRD.** Không có chức năng giáo viên cấp thêm lượt. Máy hỏng ở lần cuối → hoãn, thi lại lúc khác (đúng Assumptions). |
| C-03 | FR-043 vs FR-045: sau khi đổi máy | Máy mới vào **phòng chờ rồi bấm "Bắt đầu làm bài"** để làm lần mới từ đầu (đủ số phút, giữ bộ câu, đảo thứ tự). "Thi tiếp" nghĩa là tiếp tục kỳ thi, **không** giữ câu đã chọn của bài cũ. |
| C-04 | FR-014: thời điểm chốt số lần làm + số lần cảnh báo | **Chốt riêng từng lớp**, tại lúc lớp đó được phát đề. |
| C-05 | FR-063/061/062: điểm lớp năm học trước | Bảng điểm và Excel năm cũ **vẫn hiện họ tên + mã học sinh**. Ngày sinh, quê quán, địa chỉ, người giám hộ vẫn ẩn. |
| C-06 | FR-045: ngưỡng gián đoạn 60 giây | **Admin trường chỉnh theo từng trường** — thêm thiết lập thứ ba vào FR-014 (mặc định 60 giây). Cũng chốt riêng từng lớp lúc phát đề như C-04. |
| C-07 | FR-046 vs thu bài | Học sinh bị tự nộp do **thu bài** vẫn thấy điểm lần vừa làm và nút "Xem đáp án" như các trường hợp hoàn thành khác. |
| C-08 | FR-018: xóa môn | Không cho xóa môn đang có giáo viên, câu hỏi hoặc bài thi gắn vào. |
| C-09 | FR-016/012/001: các tình huống biên | Mã học sinh đã bị vô hiệu **không cấp lại** cho người khác. Học sinh chuyển trường = xóa dữ liệu ở trường cũ + nhập mới ở trường mới, **không** chuyển dữ liệu giữa hai trường. Trường bị khóa: học sinh **vẫn tra cứu được điểm cũ** nhưng không vào thi được. |
| C-10 | Lưu ảnh câu hỏi (FR-021) | **Supabase Storage**, bucket riêng tư; Koa cấp link tạm thời khi xem trước/khi học sinh làm bài. Gói free: 1 GB file (cần kiểm lại ở design). |
| C-11 | Xác thực + truy cập dữ liệu | **Koa tự xác thực** (đúng BRD). Trình duyệt **không** gọi Supabase trực tiếp; mọi truy cập dữ liệu qua Koa dùng khóa service-role giữ ở máy chủ. Đáp án đúng không bao giờ xuống trình duyệt khi đang thi. |
| C-12 | Realtime (FR-035) + heartbeat (FR-045) | **SSE từ Koa** cho giáo viên theo dõi trực tiếp; trình duyệt học sinh gửi **heartbeat HTTP** định kỳ, Koa tự đo gián đoạn theo ngưỡng (FR-014/C-06). |
| C-13 | G-1: tải lại/mất mạng vs đổi máy trong ngưỡng gián đoạn | Phân biệt bằng **token phiên lưu trong trình duyệt**. Còn token → làm tiếp bài cũ, không mất lượt. Nhập mã ở trình duyệt/máy khác (không có token), hoặc đã xóa dữ liệu trình duyệt → coi là **đổi máy**: máy cũ bị đẩy, mất 1 lượt (C-02). |

## Roles & Permissions

Chỉ có 4 vai trò hệ thống (không có vai trò nào khác):

| Role | Quyền |
|---|---|
| Admin tổng | Tạo/khóa trường; tạo tài khoản + đặt lại mật khẩu admin trường; xem thống kê tổng hợp. **Tuyệt đối không** xem/sửa/xóa dữ liệu riêng của trường (FR-004, BR-015). Tài khoản chỉ thêm trực tiếp vào DB (FR-005). |
| Admin trường | Chỉ trong trường mình: quản lý môn, tài khoản giáo viên, học sinh, lớp theo năm học, phân công, thiết lập số lần làm bài, số lần cảnh báo và ngưỡng gián đoạn (C-06); xem (không sửa) câu hỏi/đề/điểm của giáo viên; xem thông tin cá nhân học sinh; xóa tay dữ liệu học sinh. |
| Giáo viên | Gắn đúng **một môn cố định** (không đổi). Quản lý ngân hàng câu hỏi + bài thi của mình; phát đề/thu bài/công bố đáp án/công bố bảng điểm theo lớp; theo dõi realtime; xem kết quả theo lớp + môn + năm học được phân công; xem họ tên, mã, lớp, tên + SĐT người giám hộ của lớp phụ trách; xem nhật ký vi phạm. |
| Học sinh/sinh viên | Không tài khoản/mật khẩu. Dùng mã để vào thi và tra cứu điểm của chính mình (không thông tin cá nhân). |

## Features

> Mỗi mục = 1 FR của BRD. Chi tiết Acceptance Criteria đầy đủ: `docs/BRD.md` (nguồn intent, không sửa).

### Module 1 — Admin tổng
- **FR-001** (High): Tạo, khóa trường. Trường bị khóa: admin/giáo viên không đăng nhập, học sinh không vào thi được; học sinh vẫn tra cứu được điểm cũ (C-09).
- **FR-002** (High): Tạo tài khoản (username, password) admin trường; đặt lại mật khẩu.
- **FR-003** (Medium): Thống kê tổng hợp theo trường: số giáo viên, học sinh, bài thi, câu hỏi, lớp, lượt thi. Chủ dự án cho phép bổ sung số liệu miễn không đụng dữ liệu riêng của trường và thông tin cá nhân nhạy cảm. Chỉ con số tổng hợp — không tên/mã/điểm/nội dung cụ thể.
- **FR-004** (High): Admin tổng không có màn hình/lệnh nào truy cập dữ liệu riêng của trường.
- **FR-005** (High): Tài khoản admin tổng thêm trực tiếp vào DB; không có chức năng web tạo admin tổng.

### Module 2 — Admin trường
- **FR-010** (High): Tạo tài khoản + đặt lại mật khẩu giáo viên; mỗi giáo viên gắn đúng 1 môn (chọn từ danh sách môn FR-018), không đổi được; không tự đăng ký.
- **FR-011** (High): Nhập danh sách học sinh từ file; mỗi dòng: mã, họ tên, lớp, ngày sinh, quê quán, SĐT người giám hộ, địa chỉ, tên người giám hộ. Mã duy nhất trong 1 trường (trùng → báo lỗi); 2 trường được trùng mã. Định dạng file: `.xlsx`, nhập theo kiểu cả file hoặc không (đề xuất trong design doc, chờ duyệt).
- **FR-012** (High): Lớp gắn năm học; mỗi năm tạo lớp, nhập khóa mới, chuyển học sinh cũ lên lớp mới. Giữ lịch sử học sinh–lớp–năm (BR-018). Học sinh chuyển trường = xóa dữ liệu ở trường cũ + nhập mới ở trường mới, không chuyển dữ liệu giữa hai trường (C-09).
- **FR-013** (High): Phân công giáo viên ↔ lớp ↔ năm học; môn = môn của giáo viên. Quyền xem của giáo viên bám theo phân công (FR-060).
- **FR-014** (High): Thiết lập chung toàn trường: số lần làm bài tối đa (mặc định 3), số lần cảnh báo gian lận (mặc định 2), và ngưỡng gián đoạn (mặc định 60 giây — C-06). Đổi chỉ áp dụng cho lớp được phát đề sau đó; mỗi lớp giữ giá trị tại thời điểm lớp đó được phát đề (C-04).
- **FR-015** (High): Admin trường xem (không sửa) câu hỏi, đề, điểm của giáo viên trong trường; không truy cập trường khác.
- **FR-016** (Medium): Xóa tay dữ liệu cá nhân học sinh khi có yêu cầu hợp lệ (họ tên, ngày sinh, quê quán, địa chỉ, người giám hộ). Điểm + bài giữ lại gắn mã nội bộ ẩn danh; mã học sinh bị vô hiệu, không tra cứu được và không cấp lại cho người khác (C-09).
- **FR-017** (Medium): Admin trường xem toàn bộ thông tin học sinh trong trường (kể cả người giám hộ).
- **FR-018** (High): Quản lý danh sách môn của trường (thêm, sửa tên, xóa); môn tách riêng giữa các trường. Không xóa được môn đang có giáo viên, câu hỏi hoặc bài thi gắn vào (C-08).

### Module 3 — Ngân hàng câu hỏi (Giáo viên)
- **FR-020** (High): Tạo câu hỏi trắc nghiệm bằng cách gõ trên web, thuộc môn của giáo viên. (Nhập từ Word: **làm sau**.)
- **FR-021** (High): Thêm hình ảnh vào câu hỏi qua web; hiển thị đúng khi xem trước và khi học sinh làm bài. (Công thức toán: **làm sau**.)
- **FR-022** (High): Mỗi câu có 1 hoặc nhiều đáp án đúng.
- **FR-023** (High): Mức độ khó: dễ / trung bình / khó (đúng 1 mức).
- **FR-024** (High): Ngân hàng riêng từng giáo viên, dùng lại qua các năm học; giáo viên khác không dùng được.

### Module 4 — Bài thi (Giáo viên)
- **FR-030** (High): Cấu hình rút ngẫu nhiên: tổng số câu + số câu dễ/TB/khó. Rút **một bộ câu một lần cho mỗi bài thi**, mọi lớp được gán dùng chung. **Sao chép nội dung** câu vào đề (sửa/xóa ngân hàng sau đó không đổi đề đã ra). Ngân hàng không đủ câu ở bất kỳ mức nào → báo lỗi, không tạo đề.
- **FR-031** (High): Đặt thời gian làm bài (phút). Không có thiết lập thời điểm mở/đóng.
- **FR-032** (High): Gán bài thi cho các lớp. Mã bài thi duy nhất toàn hệ thống + link. Học sinh lớp khác bị chặn.
- **FR-033** (High): Phòng chờ + phát đề theo từng lớp. Trước phát đề: vào phòng chờ nhưng không làm bài. Sau phát đề: học sinh tự bấm "Bắt đầu làm bài".
- **FR-034** (High): Giáo viên đóng/thu bài theo lớp: chưa bấm "Bắt đầu" → không làm được nữa; đang làm dở → tự nộp + chấm ngay; đang gián đoạn (FR-045) → điểm cao nhất trong các lần đã chấm.
- **FR-035** (High): Theo dõi realtime trạng thái từng học sinh của lớp: đang chờ / đang làm / đã nộp / chưa làm.
- **FR-036** (High): Mỗi học sinh có thứ tự câu khác nhau; thứ tự đáp án A–D trộn; chấm đúng theo đáp án gốc.
- **FR-037** (High): Nút "Công bố đáp án" theo lớp (bấm tay).
- **FR-038** (High): Nút "Công bố bảng điểm" theo lớp (bấm tay).
- **FR-039** (Medium): Giáo viên sửa đáp án đúng sau thi, làm trên bản sao trong đề; hệ thống tự chấm lại bài liên quan (lựa chọn của học sinh không đổi; điểm đã công bố tự cập nhật).

### Module 5 — Học sinh làm bài
- **FR-040** (High): Vào bằng mã bài thi hoặc link, rồi nhập mã học sinh. Không có bước chọn trường; hệ thống kiểm tra mã thuộc trường + lớp được gán.
- **FR-041** (High): Đồng hồ riêng từng học sinh, tính từ lúc bấm "Bắt đầu làm bài". Hết giờ → tự nộp các câu đã chọn. Thời gian tính theo giờ máy chủ.
- **FR-042** (Medium): Quay lại sửa/nhảy giữa các câu đến lúc nộp.
- **FR-043** (High): Một mã chỉ thi một bài tại một thời điểm. Phòng chờ không khóa mã; mã khóa khi bấm "Bắt đầu". Đăng nhập máy thứ 2 (kể cả ở phòng chờ) → máy 1 bị đăng xuất ngay; bài đang làm ở máy cũ = 1 lần gián đoạn (được chấm, mất 1 lượt); máy mới vào phòng chờ rồi bấm "Bắt đầu làm bài" để làm lần mới từ đầu (C-03); đẩy máy không được miễn lượt, kể cả khi nạn nhân đang ở lần cuối (C-02). Ghi nhật ký mỗi lần đẩy máy (thời điểm, mã học sinh). Phải có mã bài thi/link trước khi nhập mã học sinh. Rủi ro đẩy học sinh khi lộ mã bài thi: chủ dự án chấp nhận.
- **FR-044** (High): Cảnh báo khi rời tab/thoát toàn màn hình; số cảnh báo do admin trường đặt (mặc định 2), đếm riêng từng lần làm; vi phạm kế tiếp → tự nộp; mỗi lần ghi nhật ký.
- **FR-045** (High): Làm lại chỉ khi gián đoạn (mất mạng/sập nguồn/đổi máy). Gián đoạn = máy chủ không nhận tín hiệu từ trình duyệt **60 giây** (mặc định; admin trường chỉnh theo trường, chốt riêng từng lớp lúc phát đề — C-06). Quay lại trong 60s → làm tiếp bài cũ, đồng hồ không dừng, không mất lượt. Bài gián đoạn chấm ngay khi phát hiện; học sinh không thấy điểm lần đó (giáo viên thấy). Làm lại: học sinh quay về phòng chờ rồi bấm "Bắt đầu làm bài"; bắt đầu từ đầu, đồng hồ + số phút mới, **giữ nguyên bộ câu**, đảo lại thứ tự câu + đáp án. Tổng số lần (tính cả lần đầu) tối đa theo admin trường (mặc định 3). Điểm chính thức = cao nhất. Đã hoàn thành (nộp/hết giờ/tự nộp do vi phạm/thu bài) → không làm lại.
- **FR-046** (High): Sau hoàn thành bài, hiện điểm lần vừa làm ngay trên trang kết quả, có nút "Xem đáp án". Áp dụng cho mọi trường hợp hoàn thành bài, kể cả bị tự nộp do giáo viên thu bài (C-07).
- **FR-047** (High): Nút "Xem đáp án" luôn hiện. Đã công bố → hiện đề + đáp án đúng (không hiện câu đã chọn); chưa → lỗi "Giáo viên chưa công bố đáp án". Chỉ xem được tại trang kết quả; không có đường vào khác.

### Module 6 — Chấm điểm
- **FR-050** (High): Tự chấm khi nộp; điểm = (số câu đúng ÷ tổng số câu) × 10, làm tròn 2 chữ số thập phân.
- **FR-051** (High): Sai không trừ điểm; bỏ trống = sai; câu nhiều đáp án chọn đúng một phần = sai.

### Module 7 — Kết quả, báo cáo, tra cứu
- **FR-060** (High): Giáo viên chỉ xem kết quả lớp được phân công + đúng môn + đúng năm học của phân công.
- **FR-061** (High): Giáo viên xem điểm từng học sinh (mọi lần làm), thống kê câu sai nhiều, bảng điểm cả lớp.
- **FR-062** (Medium): Xuất Excel bảng điểm: điểm chính thức (cao nhất) + số lần làm; không xuất chi tiết từng lần.
- **FR-063** (Medium): Giáo viên xem họ tên, mã, lớp, tên + SĐT người giám hộ của lớp đang phụ trách; **không** xem ngày sinh, quê quán, địa chỉ. Lớp năm học trước: chỉ xem điểm; bảng điểm + Excel vẫn hiện họ tên + mã học sinh, ẩn ngày sinh/quê quán/địa chỉ/người giám hộ (C-05).
- **FR-064** (High): Tra cứu điểm của học sinh: chọn trường + nhập mã; bảng điểm một năm học theo môn (mặc định năm hiện tại, chọn được năm trước); chỉ điểm của mình; chỉ bài đã công bố bảng điểm; không thông tin cá nhân; điểm chính thức, tự cập nhật khi chấm lại.
- **FR-065** (Medium): Giáo viên xem nhật ký vi phạm (rời tab/thoát toàn màn hình) + nhật ký đẩy máy trong trang chi tiết từng lần làm.

## Business Rules

| ID | Quy tắc |
|---|---|
| BR-001 | Bài đã nộp không sửa được (chấm lại theo FR-039 không đổi lựa chọn của học sinh). |
| BR-002 | Giáo viên không xóa được đề đã có người thi; sửa/xóa câu ngân hàng không đổi đề đã ra. |
| BR-003 | Mã học sinh duy nhất trong 1 trường; mã bài thi duy nhất toàn hệ thống. |
| BR-004 | Một mã chỉ làm một bài tại một thời điểm (khóa từ lúc "Bắt đầu"); máy 2 đăng nhập → máy 1 bị đăng xuất. |
| BR-005 | Số lần làm tối đa do admin trường đặt (mặc định 3, tính cả lần đầu); chỉ làm lại khi gián đoạn; hoàn thành thì không làm lại; điểm chính thức = cao nhất. |
| BR-006 | Phát đề/thu bài riêng từng lớp; học sinh chỉ làm sau khi lớp được phát đề + tự bấm "Bắt đầu"; sau thu bài không bắt đầu được nữa. |
| BR-007 | Đồng hồ mỗi học sinh tính từ lúc bấm "Bắt đầu"; kết thúc khi nộp/hết giờ. |
| BR-008 | Câu đúng điểm bằng nhau; thang 10; làm tròn 2 số lẻ; sai không trừ; bỏ trống sai; đúng một phần sai. |
| BR-009 | Cảnh báo gian lận theo số lần admin trường đặt (mặc định 2), đếm riêng từng lần làm; vi phạm kế → tự nộp. |
| BR-010 | Công bố đáp án và công bố bảng điểm là 2 thao tác riêng, bấm tay, theo lớp. |
| BR-011 | Giáo viên xem kết quả theo đúng lớp được phân công, môn của mình, năm học. |
| BR-012 | Tài khoản giáo viên/admin do cấp trên cấp, không tự đăng ký. |
| BR-013 | Tra cứu của học sinh không hiện thông tin cá nhân; chỉ hiện điểm sau khi công bố bảng điểm. |
| BR-014 | Học sinh lớp không được gán thì không vào được bài thi. |
| BR-015 | Admin tổng không truy cập dữ liệu riêng của trường; admin trường không xem trường khác. |
| BR-016 | Thông tin người giám hộ chỉ admin trường + giáo viên phụ trách lớp xem; lưu vĩnh viễn trừ khi admin trường xóa tay (FR-016). |
| BR-017 | Mỗi giáo viên đúng một môn, cố định, chọn khi tạo tài khoản; không hỗ trợ dạy hai môn. |
| BR-018 | Lớp gắn năm học; giữ lịch sử học sinh–lớp–năm. |

## Tech Stack

Chỉ ghi những gì BRD (mục Constraints) và Clarifications (C-01) đã chốt:

| Lớp | Công nghệ |
|---|---|
| Giao diện | Next.js |
| Máy chủ | Koa.js — **tự làm xác thực** (admin/giáo viên: tài khoản do cấp trên cấp) |
| Cơ sở dữ liệu | **Supabase (Postgres)** — theo C-01, thay Firestore. Gói miễn phí; giới hạn (dung lượng, tự tạm dừng khi không dùng) **[cần xác nhận]** ở brainstorm. |
| Lưu ảnh | **Supabase Storage** (bucket riêng tư, qua proxy Koa) — C-10 |
| Realtime (FR-035, heartbeat FR-045) | **SSE từ Koa** + heartbeat HTTP 5 giây — C-12 |
| Cơ chế phiên | Token đục lưu hash trong DB, cookie HttpOnly (design doc `docs/specs/2026-11-25-quiq-design.md`) |
| Cấu trúc repo, package manager | Monorepo **pnpm**: `apps/web` (Next.js), `apps/api` (Koa), `packages/shared`; Node 22 |
| ORM / migration | **Drizzle ORM + drizzle-kit** trên Postgres Supabase (migration versioned) |
| Test | Vitest + PGlite (unit/integration), Playwright (smoke e2e) |
| UI library | Tailwind làm nền, kết hợp nhiều thư viện — **chốt ở bước /design** |

## API Endpoints

**[cần xác nhận]** — chưa có code. Nhóm endpoint dự kiến (chi tiết chốt ở design doc/graph; sau build: `docs/API_SPEC.md` + code là nguồn thật): auth (admin/giáo viên), quản lý trường/tài khoản, quản lý lớp/học sinh/phân công/môn, ngân hàng câu hỏi, bài thi + phát đề/thu bài/công bố, phiên thi của học sinh (vào/bắt đầu/heartbeat/lưu đáp án/nộp), báo cáo + xuất Excel, tra cứu điểm công khai (theo trường + mã).

## Database Schema

**[cần xác nhận]** — Supabase (Postgres, quan hệ): sẽ cần **migration versioned** (`db_tool` ≠ none → áp dụng migration gate trong AGENTS.md), cô lập dữ liệu theo trường (cột school_id / RLS). Thực thể nghiệp vụ chính từ BRD: School, SchoolAdmin, SuperAdmin, Subject, Teacher, AcademicYear, Class, Student (+ lịch sử StudentClassYear), TeacherAssignment, SchoolSettings, Question, Exam (+ bản sao câu hỏi trong đề), ExamClassAssignment (trạng thái phát đề/thu bài/công bố theo lớp), Attempt (bài làm từng lần + câu đã chọn + thứ tự trộn), ViolationLog, TakeoverLog. Ràng buộc đáng chú ý: mã học sinh duy nhất theo trường; mã bài thi duy nhất toàn hệ thống; học sinh bị xóa dữ liệu cá nhân giữ mã nội bộ ẩn danh.

## Authentication

- Admin tổng, admin trường, giáo viên: username + password, **Koa.js tự xác thực**; không tự đăng ký; không đăng nhập Google. Admin tổng chỉ thêm trực tiếp vào DB.
- Học sinh: không tài khoản; vào thi bằng mã bài thi/link + mã học sinh; tra cứu điểm bằng trường + mã học sinh.
- Phiên của học sinh: một mã chỉ một phiên đang hoạt động (đăng nhập máy 2 → vô hiệu máy 1 ngay).
- Phân quyền chặt theo bảng Roles & Permissions; cô lập dữ liệu theo trường (BR-015).

## Non-Functional Requirements

| Hạng mục | Yêu cầu |
|---|---|
| Performance | Không có yêu cầu; chỉ kiểm thử ~3–4 người thi đồng thời. Về nghiệp vụ nhiều trường có thể thi cùng lúc. |
| Security | Đáp án đúng chỉ nằm ở máy chủ, không gửi xuống trình duyệt khi đang thi; thời gian tính theo giờ máy chủ; một mã một bài một thời điểm; phân quyền chặt. |
| Scalability | Chưa có yêu cầu. Scalability Option: **off** (không áp dụng). |
| Availability | Không cam kết; sự cố → hoãn thi, thi lại. |
| Accessibility | Chưa cần. |
| Platform | Chỉ máy tính (trình duyệt); không điện thoại; trình duyệt cụ thể chưa cần quan tâm. |
| Language | Chỉ tiếng Việt. |
| Realtime | Trạng thái học sinh cập nhật trực tiếp (FR-035). |
| Privacy/Regulatory | Dữ liệu cá nhân học sinh (nhiều trẻ em) + người giám hộ. Tham chiếu: Luật BVDLCN 91/2025/QH15, NĐ 356/2025/NĐ-CP, NĐ 330/2026/NĐ-CP (Claude tra từ tóm tắt, chưa đọc toàn văn; chủ dự án quyết định không cần xác nhận pháp lý). Đáp ứng quyền rút đồng ý bằng FR-016. Điểm liên quan trực tiếp: (a) công bố/tiết lộ dữ liệu cá nhân của trẻ từ đủ 7 tuổi cần sự đồng ý của trẻ và người đại diện theo pháp luật; (b) dữ liệu cá nhân nhạy cảm cần quy định phân quyền giới hạn truy cập, quy trình xử lý và biện pháp bảo mật. |

## Assumptions (từ BRD — chủ dự án đã chấp nhận)

- Mỗi trường có dữ liệu riêng; trường này không xem được dữ liệu trường khác.
- Học sinh thi trên máy tính có trình duyệt và kết nối mạng.
- Mã học sinh do admin trường cấp đúng cho đúng người; học sinh không có mật khẩu.
- Người ngoài lớp dùng mã học sinh để xem điểm: **chủ dự án chấp nhận** (màn hình tra cứu không hiện thông tin cá nhân).
- Dùng mã học sinh để đẩy bạn đang thi ra ngoài chỉ làm được khi có mã bài thi; chủ dự án coi là rủi ro phòng tránh được bằng cách giữ kín mã bài thi.
- Học sinh đóng trang kết quả thì không còn đường xem lại đáp án (đã quyết định như vậy).
- Sự cố trong giờ thi: trường chấp nhận hoãn và thi lại.
- Mọi lần học sinh thoát giữa chừng quá 60 giây đều tính là gián đoạn (chưa phân biệt gián đoạn thật với cố ý thoát); **giới hạn số lần làm là biện pháp chặn duy nhất** việc cố ý thoát để làm lại.

## Scalability Profile

- **Scalability Option:** off (không áp dụng) — đi theo mặc định đơn giản.

## Out of Scope

Câu hỏi không phải trắc nghiệm; app/giao diện mobile; đăng nhập Google, tự đăng ký; tài khoản/mật khẩu cho học sinh; ngôn ngữ khác tiếng Việt; giáo viên dạy hai môn / đổi môn; thiết lập thời điểm mở/đóng bài thi.

**Làm sau (đã ghi nhận, chưa làm ở giai đoạn này):** nhập câu hỏi hàng loạt từ Word (làm cùng tính năng nhập đề); công thức toán trong câu hỏi; cách xác định học sinh "ra trường".

## Deployment

Hiện chạy local (Koa trên máy chủ dự án, kết nối Supabase thật theo C-01). Mục tiêu "thi từ xa" cần host Koa công khai về sau — nền tảng miễn phí **[cần xác nhận]**. Chưa triển khai; ràng buộc: chỉ dùng hạ tầng miễn phí cả hiện tại và khi triển khai sau này. Nền tảng deploy/CI-CD: **[cần xác nhận]** ở brainstorm.

## Open Questions (chủ dự án đã ghi nhận hoãn — KHÔNG phải gap của spec)

1. Cách xác định học sinh "ra trường" (tạm bỏ qua; chỉ có xóa tay).
2. Cách ghi nhận sự đồng ý của người giám hộ: hệ thống ghi hay trường làm ngoài hệ thống.
3. Giới hạn gói miễn phí của nền dữ liệu (nay là Supabase thay vì Firebase) so với nhu cầu triển khai thật — chưa kiểm tra.

**Đã giải quyết (C-01):** Cloud Storage for Firebase yêu cầu gói Blaze → xung đột "chỉ hạ tầng miễn phí"; chủ dự án chọn chuyển sang Supabase. Nguồn: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

---
*Generated by: main session (greenfield — dựng từ docs/BRD.md, không reverse-engineer)*
*Validation: vòng 1 = FAIL (6 ⚠️ — xem .context/review-reports/spec-validation.md); đã làm rõ với chủ dự án (mục Clarifications C-01..C-09) và bổ sung Assumptions + Regulatory; vòng 2 = PASS (0 ❌, 1 ⚠️ G-1 còn mở: phân biệt reload cùng máy vs đổi máy trong 60s — chốt ở brainstorm). Thân FR đã đồng bộ với Clarifications.*
