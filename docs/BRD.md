# Business Requirements Document (BRD)

> Bản đã cập nhật theo các câu trả lời và các đề xuất đã được chủ dự án duyệt (ngày 2026-11-25).
> Quy ước: mục ghi **[CHƯA XÁC ĐỊNH]** nghĩa là chủ dự án chưa trả lời, không tự điền. Các chỗ cần làm rõ nằm ở phần "Open Questions".

---

## Project Overview

**Project Name:** Quiq
**Version:** 1.0
**Date:** 2026-11-25
**Author:** Duc Minh

## Business Context

**Problem Statement:**
Hiện nay việc thi trắc nghiệm ở các trường được tổ chức bằng giấy. Giáo viên phải chấm tay, khó thi từ xa, khó chống gian lận. Quiq là web thi trắc nghiệm trực tuyến dùng chung cho nhiều trường: giáo viên ra đề, học sinh/sinh viên làm bài có giới hạn thời gian, hệ thống tự chấm điểm.

**Business Objectives:**
- Giảm thời gian chấm bài (chấm điểm tự động).
- Chống gian lận khi thi.
- Cho phép thi từ xa (thi trực tuyến).

**Success Metrics:**
- **[CHƯA XÁC ĐỊNH]** — chủ dự án nói chưa cần đo ở giai đoạn này.

**Trạng thái dự án:** đang chạy trên máy cá nhân của chủ dự án (local), chưa triển khai, chưa chạy thật cho người dùng.

---

## Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Product Owner | Duc Minh | Quyết định cuối cùng về yêu cầu |
| Developer | Duc Minh | Xây dựng hệ thống |
| Admin tổng | (vai trò hệ thống) | Quản trị hệ thống, không đụng dữ liệu riêng của trường |
| Admin trường | (vai trò hệ thống) | Quản trị dữ liệu của trường mình |
| Giáo viên | (vai trò hệ thống) | Mỗi giáo viên gắn một môn; tạo câu hỏi, ra đề, tổ chức thi, xem kết quả của môn đó |
| Học sinh/sinh viên | (vai trò hệ thống) | Làm bài thi, tra cứu điểm |

Không có vai trò người dùng nào khác ngoài bốn vai trò hệ thống ở trên.

---

## Scope

### In Scope
- Hệ thống dùng chung cho **nhiều trường**, nhiều trường có thể thi cùng lúc; dữ liệu mỗi trường tách riêng.
- Admin tổng: quản lý trường, tài khoản admin trường, xem thống kê tổng hợp.
- Admin trường: danh sách môn của trường, tài khoản giáo viên (mỗi giáo viên gắn một môn cố định), mã học sinh/sinh viên, danh sách và lớp theo năm học, phân công giáo viên theo lớp và năm học, thiết lập số lần làm bài và số lần cảnh báo.
- Ngân hàng câu hỏi riêng của từng giáo viên, theo môn của giáo viên đó; tạo câu hỏi bằng cách gõ trên web; câu hỏi có hình ảnh; mức độ khó (dễ, trung bình, khó).
- Tạo đề bằng cách rút ngẫu nhiên từ ngân hàng câu hỏi theo cấu hình của giáo viên.
- Phòng chờ; phát đề theo từng lớp; học sinh tự bấm "Bắt đầu làm bài"; thu bài theo từng lớp; theo dõi trực tiếp (realtime) học sinh đang chờ, đang làm, đã nộp, chưa làm.
- Bài thi có giới hạn thời gian; trộn thứ tự câu hỏi và đáp án.
- Chấm điểm tự động, thang điểm 10.
- Chống gian lận: cảnh báo khi rời tab hoặc thoát toàn màn hình, chỉ cho một mã thi một bài trên một máy tại một thời điểm.
- Công bố đáp án và công bố bảng điểm theo từng lớp.
- Giáo viên xem điểm từng em, thống kê câu sai nhiều, bảng điểm cả lớp, nhật ký vi phạm; xuất Excel.
- Học sinh/sinh viên tra cứu điểm bằng mã.
- Giao diện tiếng Việt, chạy trên máy tính.

### Làm sau (đã ghi nhận là yêu cầu cho tương lai, chưa làm ở giai đoạn này)
- Nhập câu hỏi hàng loạt từ file Word (chưa có file Word mẫu; sẽ làm cùng tính năng nhập đề thi).
- Công thức toán trong câu hỏi.
- Cách xác định học sinh "ra trường" (xem Open Questions).

### Out of Scope
- Câu hỏi dạng khác ngoài trắc nghiệm (tự luận, điền chỗ trống…).
- Ứng dụng/giao diện cho điện thoại.
- Đăng nhập bằng Google; học sinh/sinh viên hoặc giáo viên tự đăng ký.
- Tài khoản và mật khẩu cho học sinh/sinh viên (học sinh chỉ dùng mã).
- Ngôn ngữ khác ngoài tiếng Việt.
- Giáo viên dạy hai môn; đổi môn của giáo viên sau khi tạo tài khoản.
- Thiết lập thời điểm mở và đóng bài thi (đã bỏ; thay bằng "phát đề" và "đóng/thu bài" theo từng lớp).

---

## Functional Requirements

### Module 1: Admin tổng (quản trị hệ thống)

**FR-001:** Admin tổng tạo, khóa trường.
- Priority: High
- Acceptance Criteria: Tạo được trường mới; khóa được một trường (trường bị khóa không đăng nhập hay tổ chức thi được).

**FR-002:** Admin tổng tạo tài khoản (tên đăng nhập, mật khẩu) cho admin trường và đặt lại mật khẩu admin trường.
- Priority: High
- Acceptance Criteria: Admin trường đăng nhập được bằng tài khoản vừa tạo; đặt lại mật khẩu thành công.

**FR-003:** Admin tổng xem thống kê tổng hợp theo từng trường: số giáo viên, số học sinh, số bài thi, số câu hỏi. Thêm số lớp và số lượt thi. Chủ dự án cho phép bổ sung số liệu miễn là không đụng dữ liệu riêng của trường và thông tin cá nhân nhạy cảm.
- Priority: Medium
- Acceptance Criteria: Chỉ hiển thị con số tổng hợp, không có tên, mã, điểm hay nội dung của bất kỳ học sinh, câu hỏi, đề thi cụ thể nào.

**FR-004:** Admin tổng tuyệt đối không được xem, sửa, xóa hay thao tác với dữ liệu riêng của từng trường (học sinh, lớp, câu hỏi, đề thi, điểm, thông tin cá nhân).
- Priority: High
- Acceptance Criteria: Không có màn hình hay lệnh nào cho phép admin tổng truy cập các dữ liệu này.

**FR-005:** Tài khoản admin tổng được thêm trực tiếp vào cơ sở dữ liệu, không có màn hình tạo tài khoản admin tổng.
- Priority: High
- Acceptance Criteria: Admin tổng đăng nhập được bằng tài khoản đã thêm vào cơ sở dữ liệu; không có chức năng nào trên web để tạo thêm admin tổng.

### Module 2: Admin trường

**FR-010:** Admin trường tạo tài khoản (tên đăng nhập, mật khẩu) cho giáo viên và đặt lại mật khẩu giáo viên. Mỗi giáo viên được gắn đúng **một môn** (chọn từ danh sách môn của trường, FR-018) khi tạo tài khoản và không đổi được môn sau đó; không hỗ trợ giáo viên dạy hai môn. Giáo viên không tự đăng ký.
- Priority: High
- Acceptance Criteria: Giáo viên đăng nhập được bằng tài khoản do admin trường cấp; mỗi tài khoản có đúng một môn; không có chức năng tự đăng ký và không có chức năng đổi môn của giáo viên.

**FR-011:** Admin trường nhập danh sách học sinh/sinh viên từ file. Mỗi dòng gồm: mã học sinh/sinh viên, họ tên, lớp, ngày sinh, quê quán, số điện thoại người giám hộ, địa chỉ, tên người giám hộ. Mã do admin cấp, duy nhất trong phạm vi một trường.
- Priority: High
- Acceptance Criteria: Nhập file tạo đúng học sinh vào đúng lớp; báo lỗi khi mã trùng trong cùng trường; hai trường khác nhau được phép có mã giống nhau.

**FR-012:** Lớp gắn với từng năm học: mỗi năm học admin trường tạo các lớp của năm đó (ví dụ lớp 10A năm 2025–2026). Mỗi năm học admin trường nhập danh sách học sinh/sinh viên khóa mới; học sinh các khóa trước được chuyển sang lớp của năm học mới (lên một lớp). Admin trường chỉ chỉnh sửa khi có thay đổi (chuyển lớp, chuyển trường, đổi thông tin cá nhân).
- Priority: High
- Acceptance Criteria: Sau khi lên lớp, hệ thống vẫn giữ lịch sử "năm học nào, học sinh học lớp nào".

**FR-013:** Admin trường phân công giáo viên phụ trách lớp theo năm học. Môn học của phân công là môn của giáo viên (FR-010).
- Priority: High
- Acceptance Criteria: Mỗi phân công gồm giáo viên, lớp, năm học; quyền xem dữ liệu của giáo viên bám theo phân công này (FR-060).

**FR-014:** Admin trường đặt hai thiết lập chung cho cả trường: số lần làm bài tối đa cho một bài thi và số lần cảnh báo gian lận. Giá trị mặc định khi tạo trường mới là 3 lần làm bài và 2 lần cảnh báo; admin trường đổi được.
- Priority: High
- Acceptance Criteria: Thay đổi thiết lập chỉ áp dụng cho các bài thi được phát đề sau đó; bài thi đã phát đề giữ giá trị tại thời điểm phát đề.

**FR-015:** Admin trường xem được (không sửa) câu hỏi, đề thi và điểm của giáo viên trong trường mình. Admin trường không xem được dữ liệu của trường khác.
- Priority: High
- Acceptance Criteria: Admin trường có quyền chỉ đọc với dữ liệu của giáo viên cùng trường; không có chức năng sửa; không truy cập được trường khác.

**FR-016:** Khi có yêu cầu hợp lệ xin xóa dữ liệu của một học sinh, admin trường xóa tay. Hệ thống xóa toàn bộ thông tin cá nhân của học sinh (họ tên, ngày sinh, quê quán, địa chỉ, tên và số điện thoại người giám hộ). Điểm và các bài đã làm được giữ lại, gắn với một mã nội bộ ẩn danh. Mã học sinh bị vô hiệu, không tra cứu được nữa.
- Priority: Medium
- Acceptance Criteria: Sau khi xóa, không còn thông tin cá nhân nào của học sinh đó; điểm vẫn còn trong thống kê và bảng điểm nhưng không gắn với tên; nhập mã cũ vào màn hình tra cứu không ra kết quả.

**FR-017:** Admin trường xem được tất cả thông tin của học sinh trong trường mình, gồm thông tin người giám hộ (tên, số điện thoại).
- Priority: Medium
- Acceptance Criteria: Chỉ admin trường và giáo viên theo phạm vi ở FR-063 xem được; admin tổng không xem được.

**FR-018:** Admin trường tạo và quản lý danh sách các môn của trường mình.
- Priority: High
- Acceptance Criteria: Admin trường thêm, sửa tên, xóa được môn trong danh sách của trường; môn của giáo viên (FR-010) chọn từ danh sách này; môn của trường này không hiện ở trường khác.

### Module 3: Ngân hàng câu hỏi (Giáo viên)

**FR-020:** Giáo viên tạo câu hỏi trắc nghiệm bằng cách gõ trên web. Giáo viên chỉ thao tác với môn của mình: câu hỏi, đề thi và bài thi tạo ra đều thuộc môn đó. (Nhập từ file Word: làm sau.)
- Priority: High
- Acceptance Criteria: Câu hỏi tạo xong có trong ngân hàng câu hỏi của giáo viên đó, thuộc môn của giáo viên.

**FR-021:** Giáo viên thêm hình ảnh vào câu hỏi qua giao diện web. (Công thức toán: làm sau.)
- Priority: High
- Acceptance Criteria: Ảnh hiển thị đúng khi giáo viên xem trước và khi học sinh làm bài.

**FR-022:** Mỗi câu hỏi có một đáp án đúng hoặc nhiều đáp án đúng.
- Priority: High
- Acceptance Criteria: Giáo viên đánh dấu được một hoặc nhiều đáp án đúng cho từng câu.

**FR-023:** Giáo viên gán mức độ khó cho từng câu hỏi: dễ, trung bình hoặc khó.
- Priority: High
- Acceptance Criteria: Mỗi câu hỏi có đúng một mức độ khó.

**FR-024:** Ngân hàng câu hỏi là riêng của từng giáo viên; giáo viên dùng lại được ở các năm học sau.
- Priority: High
- Acceptance Criteria: Giáo viên khác không dùng được câu hỏi này (admin trường chỉ xem); sang năm học mới câu hỏi cũ vẫn còn.

### Module 4: Bài thi (Giáo viên)

**FR-030:** Giáo viên đặt cấu hình rút câu ngẫu nhiên cho từng bài thi: tổng số câu, số câu dễ, số câu trung bình, số câu khó. Hệ thống rút **một bộ câu một lần cho mỗi bài thi**; mọi lớp được gán bài thi dùng chung bộ câu này. Khi ra đề, hệ thống **sao chép nội dung các câu được rút vào đề**; sửa hoặc xóa câu trong ngân hàng sau đó không làm đổi đề đã ra.
- Priority: High
- Acceptance Criteria: Bộ câu rút ra đúng tổng số câu và đúng số câu theo từng mức độ khó đã cấu hình. Nếu ngân hàng câu hỏi của giáo viên không đủ số câu theo cấu hình (ở bất kỳ mức độ khó nào), hệ thống báo lỗi và không tạo được đề. Sửa hoặc xóa câu trong ngân hàng không thay đổi đề đã ra.

**FR-031:** Giáo viên đặt thời gian làm bài (số phút) cho bài thi. Không còn thiết lập thời điểm mở/đóng bài thi.
- Priority: High
- Acceptance Criteria: Thời gian làm bài của mỗi học sinh bằng đúng số phút này (xem FR-041).

**FR-032:** Giáo viên gán bài thi cho một số lớp nhất định. Bài thi có mã bài thi (duy nhất trên toàn hệ thống) và đường link.
- Priority: High
- Acceptance Criteria: Chỉ học sinh thuộc lớp được gán mới vào được; học sinh lớp khác nhập mã bài thi hoặc mở link thì bị chặn.

**FR-033:** Phòng chờ và phát đề. Học sinh vào bài thi (mã bài thi hoặc link, rồi mã học sinh) khi giáo viên chưa phát đề thì vào **phòng chờ** và chưa làm bài được. Giáo viên bấm "phát đề" riêng cho từng lớp. Sau khi phát đề, học sinh của lớp đó tự bấm "Bắt đầu làm bài" để bắt đầu.
- Priority: High
- Acceptance Criteria: Trước khi phát đề, học sinh vào được phòng chờ nhưng không bắt đầu làm bài được; sau khi phát đề, học sinh lớp đó bấm "Bắt đầu làm bài" thì bắt đầu làm; học sinh lớp chưa được phát đề vẫn ở phòng chờ.

**FR-034:** Giáo viên bấm "đóng/thu bài" cho từng lớp. Học sinh chưa bấm "Bắt đầu làm bài" (kể cả đang ở phòng chờ) thì không làm được nữa. Học sinh đang làm dở thì bài được tự nộp ngay và được chấm. Học sinh đang ở trạng thái gián đoạn (FR-045) thì điểm là điểm cao nhất trong các lần đã chấm.
- Priority: High
- Acceptance Criteria: Sau khi thu bài, không học sinh nào của lớp đó bắt đầu được lần làm mới; các bài đang làm dở được nộp và có điểm.

**FR-035:** Giáo viên xem trực tiếp (realtime) trạng thái từng học sinh của lớp: đang chờ (đã vào phòng chờ), đang làm, đã nộp, chưa làm.
- Priority: High
- Acceptance Criteria: Trạng thái cập nhật khi học sinh vào phòng chờ, bấm "Bắt đầu làm bài", nộp bài.

**FR-036:** Mỗi học sinh nhận thứ tự câu hỏi khác nhau; thứ tự các đáp án A, B, C, D cũng được trộn.
- Priority: High
- Acceptance Criteria: Hai học sinh trong cùng bài thi có thể thấy thứ tự câu và thứ tự đáp án khác nhau; chấm điểm vẫn đúng theo đáp án gốc.

**FR-037:** Giáo viên bấm nút "Công bố đáp án" theo từng lớp (nút riêng, bấm tay).
- Priority: High
- Acceptance Criteria: Chỉ sau khi bấm thì học sinh lớp đó mới xem được đề và đáp án đúng (FR-047).

**FR-038:** Giáo viên bấm nút "Công bố bảng điểm" theo từng lớp (nút riêng, bấm tay).
- Priority: High
- Acceptance Criteria: Chỉ sau khi bấm thì điểm bài thi đó của học sinh lớp đó mới hiện ở màn hình tra cứu (FR-064).

**FR-039:** Giáo viên được sửa đáp án đúng của câu hỏi sau khi thi. Việc sửa làm trên bản sao của câu hỏi trong đề (FR-030). Sau khi sửa, hệ thống chấm lại tự động các bài liên quan.
- Priority: Medium
- Acceptance Criteria: Điểm của các bài đã nộp được tính lại theo đáp án mới; lựa chọn của học sinh không bị thay đổi; điểm đã công bố ở màn hình tra cứu tự cập nhật theo điểm chấm lại.

### Module 5: Học sinh/sinh viên làm bài

**FR-040:** Học sinh/sinh viên không có tài khoản/mật khẩu. Vào bài thi bằng mã bài thi hoặc link, rồi nhập mã học sinh/sinh viên. Không có bước "chọn trường": hệ thống biết trường qua bài thi và kiểm tra mã học sinh có đúng là của trường đó (và của lớp được gán) hay không.
- Priority: High
- Acceptance Criteria: Mã đúng và thuộc lớp được gán thì vào được; sai mã hoặc không thuộc lớp/trường thì bị chặn.

**FR-041:** Mỗi học sinh có đồng hồ riêng theo số phút giáo viên đặt, tính từ lúc em bấm "Bắt đầu làm bài" (giờ bắt đầu của từng em khác nhau). Bài kết thúc khi em bấm nộp hoặc hết giờ (tự nộp).
- Priority: High
- Acceptance Criteria: Đồng hồ chỉ chạy sau khi bấm "Bắt đầu làm bài"; hết giờ thì bài tự nộp với các câu đã chọn; nộp sớm thì kết thúc ngay.

**FR-042:** Trong lúc làm bài, học sinh quay lại sửa câu đã làm và nhảy qua lại giữa các câu được.
- Priority: Medium
- Acceptance Criteria: Chuyển được tới bất kỳ câu nào và đổi đáp án đến lúc nộp.

**FR-043:** Một mã học sinh tại một thời điểm chỉ thi một bài. Phòng chờ không khóa mã; mã chỉ bị khóa khi học sinh bấm "Bắt đầu làm bài". Nếu cùng mã đó đăng nhập vào máy thứ hai (kể cả đang ở phòng chờ), máy thứ nhất bị đăng xuất ngay lập tức và học sinh thi tiếp trên máy thứ hai (để xử lý khi máy hỏng). Bài đang làm ở máy cũ tính là một lần gián đoạn (được chấm điểm, mất một lượt); máy mới bắt đầu lần làm mới từ đầu. Mỗi lần đẩy máy được ghi nhật ký (thời điểm, mã học sinh). Muốn vào bài thi phải có mã bài thi (hoặc link) trước khi nhập mã học sinh. Chủ dự án cho rằng việc đẩy học sinh đang thi ra ngoài chỉ xảy ra khi mã bài thi bị lộ, và việc này phòng tránh được; rủi ro còn lại được chấp nhận.
- Priority: High
- Acceptance Criteria: Đăng nhập máy 2 thì máy 1 bị đăng xuất trong thời gian ngắn; khi đang làm bài môn A (đã bấm "Bắt đầu làm bài"), không dùng cùng mã để làm bài môn B; mỗi lần đẩy máy có một dòng nhật ký.

**FR-044:** Chống gian lận: khi học sinh chuyển sang tab khác hoặc thoát chế độ toàn màn hình, hệ thống cảnh báo. Số lần cảnh báo do admin trường đặt (mặc định 2), tính riêng cho từng lần làm bài (làm lại thì đếm lại từ đầu). Vi phạm lần tiếp theo sau số lần cảnh báo (mặc định là lần thứ 3) thì bài tự nộp. Mỗi lần vi phạm được ghi nhật ký.
- Priority: High
- Acceptance Criteria: Mỗi lần vi phạm đều có cảnh báo cho đến hết số lần quy định; vi phạm kế tiếp thì tự nộp; các lần vi phạm được ghi lại và giáo viên xem được (FR-065).

**FR-045:** Làm lại khi bị gián đoạn. Chỉ khi bị gián đoạn (mất mạng, sập nguồn, bị đổi máy) học sinh mới được làm lại. Máy chủ coi là gián đoạn khi không nhận được tín hiệu từ trình duyệt của học sinh trong **60 giây** (con số chỉnh được). Học sinh tải lại trang hoặc mạng chập chờn mà quay lại trong 60 giây thì làm tiếp bài cũ, đồng hồ không dừng, không mất lượt. Bài bị gián đoạn được chấm ngay khi phát hiện; học sinh không thấy điểm của lần đó (giáo viên thấy). Học sinh quay về phòng chờ rồi bấm "Bắt đầu làm bài" để làm lại. Làm lại là bắt đầu từ đầu, có đồng hồ riêng và đủ số phút mới. Bộ câu giữ nguyên bộ đã rút của bài thi; thứ tự câu và thứ tự đáp án A, B, C, D được đảo lại. Tổng số lần làm (tính cả lần đầu) tối đa theo thiết lập của admin trường (mặc định 3). Điểm chính thức là điểm cao nhất trong các lần. Sau khi hoàn thành bài (nộp, hết giờ, hoặc bị tự nộp do vi phạm hoặc thu bài) thì không được làm lại. Mọi lần thoát giữa chừng quá 60 giây đều tính là gián đoạn; giới hạn số lần là biện pháp chặn duy nhất việc cố ý thoát để làm lại.
- Priority: High
- Acceptance Criteria: Bài dở dang được chấm theo các câu đã chọn; lần mới đủ số phút; không vượt quá số lần tối đa; bài đã hoàn thành thì không vào lại được; giáo viên xem được tất cả các lần.

**FR-046:** Sau khi hoàn thành bài (nộp, hết giờ, hoặc bị tự nộp), học sinh thấy điểm của lần vừa làm ngay trên trang kết quả. Trang kết quả có nút "Xem đáp án".
- Priority: High
- Acceptance Criteria: Điểm hiện ngay sau khi hoàn thành bài.

**FR-047:** Nút "Xem đáp án" luôn hiện trên trang kết quả. Khi học sinh bấm: nếu giáo viên đã công bố đáp án thì hiện đề và đáp án đúng (không hiển thị câu mình đã chọn); nếu chưa công bố thì hiện thông báo lỗi "Giáo viên chưa công bố đáp án". Học sinh phải ở nguyên trang kết quả để xem; không có nơi nào khác để xem đáp án.
- Priority: High
- Acceptance Criteria: Nút luôn hiện; chưa công bố thì bấm vào chỉ ra thông báo lỗi, không lộ đáp án; đã công bố thì xem được đề và đáp án đúng ở trang kết quả; không có đường vào xem đáp án từ màn hình khác.

### Module 6: Chấm điểm tự động

**FR-050:** Hệ thống tự chấm khi bài được nộp. Mỗi câu đúng có điểm bằng nhau, thang điểm 10; điểm làm tròn đến 2 chữ số thập phân.
- Priority: High
- Acceptance Criteria: Điểm = (số câu đúng ÷ tổng số câu) × 10, làm tròn đến 2 chữ số thập phân.

**FR-051:** Câu sai không bị trừ điểm. Câu bỏ trống tính là sai. Câu có nhiều đáp án đúng mà học sinh chọn đúng một phần thì tính là sai.
- Priority: High
- Acceptance Criteria: Chỉ câu chọn đúng và đủ mới được tính điểm.

### Module 7: Kết quả, báo cáo, phạm vi xem dữ liệu và tra cứu

**FR-060:** Giáo viên chỉ xem được kết quả của các lớp mình được phân công, đúng môn của mình, và đúng năm học của phân công đó. Ví dụ: năm 2025–2026 dạy lớp A, B, C; năm 2026–2027 đang dạy E, F, G thì vẫn xem lại được A, B, C nhưng chỉ phần của năm 2025–2026; với E, F, G chỉ xem phần năm 2026–2027.
- Priority: High
- Acceptance Criteria: Giáo viên không xem được kết quả của lớp/môn/năm không thuộc phân công và môn của mình.

**FR-061:** Giáo viên xem điểm từng học sinh (kể cả tất cả các lần làm), thống kê các câu nhiều học sinh làm sai, và bảng điểm cả lớp.
- Priority: High
- Acceptance Criteria: Ba loại báo cáo trên hiển thị đúng dữ liệu của bài thi.

**FR-062:** Giáo viên xuất bảng điểm ra file Excel, gồm điểm chính thức (cao nhất) và số lần làm của từng học sinh. Không xuất chi tiết từng lần.
- Priority: Medium
- Acceptance Criteria: File Excel có đúng dữ liệu bảng điểm đang xem, gồm cột điểm chính thức và cột số lần làm.

**FR-063:** Giáo viên xem được: họ tên, mã, lớp, tên và số điện thoại người giám hộ của học sinh thuộc lớp mình đang được phân công. Giáo viên không xem được ngày sinh, quê quán, địa chỉ. Với lớp của các năm học trước, giáo viên chỉ xem điểm, không xem thông tin cá nhân.
- Priority: Medium
- Acceptance Criteria: Giáo viên không xem được thông tin học sinh ngoài lớp đang phụ trách và không xem được các trường thông tin nêu trên.

**FR-064:** Học sinh/sinh viên tra cứu điểm: dùng chung một giao diện cho mọi học sinh. Chọn trường, nhập mã học sinh/sinh viên. Màn hình hiện toàn bộ bảng điểm của một năm học (theo môn), chỉ điểm của chính mình. Xem được cả các năm trước. Có ô chọn năm học, mặc định là năm học hiện tại. Chỉ hiện điểm của bài thi mà giáo viên đã công bố bảng điểm. Không hiện thông tin cá nhân. Điểm hiện là điểm chính thức (cao nhất) và tự cập nhật nếu bài được chấm lại (FR-039).
- Priority: High
- Acceptance Criteria: Nhập mã đúng thì thấy điểm các bài đã công bố theo môn và năm học; không có họ tên, ngày sinh, địa chỉ hay số điện thoại; bài chưa công bố thì không hiện.

**FR-065:** Giáo viên xem nhật ký vi phạm gian lận (rời tab, thoát toàn màn hình) và nhật ký đẩy máy của từng học sinh trong trang chi tiết từng lần làm bài.
- Priority: Medium
- Acceptance Criteria: Trang chi tiết lần làm bài hiển thị các lần vi phạm và các lần đẩy máy kèm thời điểm.

---

## Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| Performance | Không có yêu cầu hiệu năng. Dự án chạy local, chỉ kiểm thử khoảng 3–4 người thi cùng lúc. Nhiều trường có thể thi cùng lúc (về mặt nghiệp vụ). |
| Security | Admin và giáo viên đăng nhập bằng tài khoản do cấp trên cấp; việc xác thực do máy chủ Koa.js tự làm. Học sinh dùng mã. Phân quyền chặt (xem mục Roles). Một mã chỉ làm một bài tại một thời điểm. Đáp án đúng chỉ nằm ở máy chủ, không gửi xuống trình duyệt khi học sinh đang thi; thời gian làm bài tính theo giờ của máy chủ. |
| Scalability | Chưa có yêu cầu (chưa chạy thật). |
| Availability | Không cam kết tỷ lệ hoạt động. Khi có sự cố thì hoãn thi và thi lại vào lúc khác. |
| Accessibility | Chưa cần quan tâm. |
| Platform | Chỉ chạy trên máy tính (trình duyệt). Không hỗ trợ điện thoại. Trình duyệt cụ thể: chưa cần quan tâm. |
| Language | Chỉ tiếng Việt. |
| Realtime | Giáo viên thấy trạng thái đang chờ/đang làm/đã nộp/chưa làm cập nhật trực tiếp (FR-035). |

---

## User Roles & Permissions

| Role | Permissions |
|------|------------|
| Admin tổng | Tạo/khóa trường; tạo tài khoản và đặt lại mật khẩu admin trường; xem thống kê tổng hợp theo trường. **Tuyệt đối không** xem, sửa, xóa hay thao tác với dữ liệu riêng của trường và thông tin cá nhân. |
| Admin trường | Chỉ trong trường mình. Tạo và quản lý danh sách môn của trường; tạo tài khoản và đặt lại mật khẩu giáo viên (gắn một môn cố định cho mỗi giáo viên); cấp mã và nhập danh sách học sinh/sinh viên; quản lý lớp theo năm học; phân công giáo viên; đặt số lần làm bài tối đa và số lần cảnh báo; xem (không sửa) câu hỏi, đề thi, điểm của giáo viên trong trường; xem thông tin cá nhân học sinh trong trường; xóa tay dữ liệu học sinh khi có yêu cầu hợp lệ. Không xem được trường khác. |
| Giáo viên | Tài khoản do admin trường cấp, gắn đúng một môn cố định (không đổi được); chỉ thao tác với môn đó. Quản lý ngân hàng câu hỏi và bài thi của chính mình; phát đề, thu bài, công bố đáp án, công bố bảng điểm theo từng lớp; theo dõi trực tiếp; xem kết quả của lớp, môn, năm học được phân công; xem họ tên, mã, lớp, tên và số điện thoại người giám hộ của học sinh lớp mình phụ trách; xem nhật ký vi phạm. |
| Học sinh/sinh viên | Không có tài khoản. Dùng mã để vào thi và tra cứu điểm của chính mình (chỉ điểm theo bài thi và năm, không có thông tin cá nhân). |

---

## Business Rules

- **BR-001:** Bài đã nộp không được sửa. (Giáo viên sửa đáp án đúng ở FR-039 làm điểm được tính lại, nhưng lựa chọn đã nộp của học sinh không thay đổi.)
- **BR-002:** Giáo viên không được xóa đề đã có người thi. Sửa hoặc xóa câu trong ngân hàng câu hỏi không làm đổi đề đã ra.
- **BR-003:** Mã học sinh/sinh viên do admin trường cấp và duy nhất trong một trường. Mã bài thi duy nhất trên toàn hệ thống.
- **BR-004:** Một mã học sinh/sinh viên tại một thời điểm chỉ làm một bài (mã bị khóa từ lúc bấm "Bắt đầu làm bài"; phòng chờ không khóa); đăng nhập máy thứ hai thì máy thứ nhất bị đăng xuất.
- **BR-005:** Số lần làm bài tối đa do admin trường quy định (mặc định 3 lần, tính cả lần đầu). Chỉ được làm lại khi bị gián đoạn. Hoàn thành bài (nộp hoặc hết giờ) thì không làm lại. Điểm chính thức là điểm cao nhất.
- **BR-006:** Giáo viên phát đề và thu bài riêng từng lớp. Học sinh chỉ làm bài được sau khi lớp mình được phát đề và em bấm "Bắt đầu làm bài"; sau khi thu bài thì không bắt đầu được nữa.
- **BR-007:** Đồng hồ của mỗi học sinh tính từ lúc em bấm "Bắt đầu làm bài"; bài kết thúc khi nộp hoặc hết giờ.
- **BR-008:** Mỗi câu đúng có điểm bằng nhau; thang 10; làm tròn 2 chữ số thập phân; sai không trừ điểm; bỏ trống là sai; chọn đúng một phần câu nhiều đáp án là sai.
- **BR-009:** Cảnh báo gian lận theo số lần admin trường đặt (mặc định 2), tính riêng cho từng lần làm bài; vi phạm kế tiếp thì tự nộp bài.
- **BR-010:** Công bố đáp án và công bố bảng điểm là hai thao tác riêng, do giáo viên bấm tay, theo từng lớp.
- **BR-011:** Giáo viên chỉ xem kết quả theo đúng lớp được phân công, đúng môn của mình, đúng năm học.
- **BR-012:** Tài khoản giáo viên và admin do cấp trên cấp, không tự đăng ký. Admin trường cấp cho giáo viên; admin tổng cấp cho admin trường.
- **BR-013:** Màn hình tra cứu của học sinh không hiển thị thông tin cá nhân, và chỉ hiện điểm sau khi giáo viên công bố bảng điểm.
- **BR-014:** Học sinh lớp không được gán bài thi thì không vào được bài thi đó.
- **BR-015:** Admin tổng không được truy cập dữ liệu riêng của trường. Admin trường không được xem trường khác.
- **BR-016:** Thông tin người giám hộ (tên, số điện thoại) chỉ admin trường và giáo viên phụ trách lớp xem được. Thông tin học sinh lưu vĩnh viễn, trừ khi admin trường xóa tay theo yêu cầu hợp lệ (FR-016).
- **BR-017:** Mỗi giáo viên gắn đúng một môn và chỉ thao tác với môn đó. Môn do admin trường chọn khi tạo tài khoản, từ danh sách môn của trường, và không đổi được sau đó. Không hỗ trợ giáo viên dạy hai môn.
- **BR-018:** Lớp gắn với từng năm học; hệ thống giữ lịch sử học sinh–lớp–năm.

---

## Constraints

- **Technical:** Next.js (giao diện), Koa.js (máy chủ, tự làm đăng nhập), Firestore (cơ sở dữ liệu của Firebase), Firebase Storage (lưu ảnh). Dùng dự án Firebase thật trên mạng của Google. Máy chủ Koa hiện chạy trên máy của chủ dự án (local), chưa triển khai.
- **Budget:** Chỉ dùng hạ tầng miễn phí, áp dụng cả giai đoạn hiện tại và khi triển khai sau này. (Giới hạn gói miễn phí của Firebase chưa được kiểm tra.)
- **Timeline:** Không có mốc thời gian.
- **Regulatory:** Hệ thống lưu dữ liệu cá nhân của học sinh (nhiều em là trẻ em) và người giám hộ. Các văn bản liên quan (Claude tra cứu từ tóm tắt và tin pháp lý, chưa đọc toàn văn; chủ dự án đã quyết định không cần xác nhận lại với người có chuyên môn pháp lý):
  - Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, hiệu lực từ 01/01/2026.
  - Nghị định 356/2025/NĐ-CP hướng dẫn Luật, hiệu lực từ 01/01/2026, thay thế Nghị định 13/2023/NĐ-CP.
  - Nghị định 330/2026/NĐ-CP (ban hành 19/08/2026) quy định xử phạt vi phạm trong lĩnh vực an ninh mạng và bảo vệ dữ liệu cá nhân.

  Một số điểm liên quan trực tiếp tới hệ thống:
  - Công bố hoặc tiết lộ dữ liệu cá nhân của trẻ em từ đủ 7 tuổi trở lên cần có sự đồng ý của trẻ và người đại diện theo pháp luật.
  - Cần ngừng xử lý dữ liệu của trẻ khi người đã đồng ý rút lại sự đồng ý. Hệ thống đáp ứng bằng cách để admin trường xóa tay dữ liệu học sinh (FR-016).
  - Với dữ liệu cá nhân nhạy cảm, cần có quy định phân quyền giới hạn truy cập, quy trình xử lý và biện pháp bảo mật.

---

## Assumptions

- Mỗi trường có dữ liệu riêng; trường này không xem được dữ liệu trường khác.
- Học sinh/sinh viên thi trên máy tính có trình duyệt và kết nối mạng.
- Mã học sinh/sinh viên do admin trường cấp đúng cho đúng người. Học sinh không có mật khẩu. Người ngoài lớp dùng mã học sinh để xem điểm thì chủ dự án chấp nhận (màn hình tra cứu không hiện thông tin cá nhân). Việc dùng mã học sinh để đẩy bạn đang thi ra ngoài chỉ làm được khi có mã bài thi; chủ dự án coi đây là rủi ro phòng tránh được bằng cách giữ kín mã bài thi.
- Học sinh đóng trang kết quả thì không còn đường xem lại đáp án; chủ dự án đã quyết định như vậy.
- Khi hệ thống gặp sự cố trong giờ thi, trường chấp nhận hoãn và tổ chức thi lại.
- Mọi lần học sinh thoát giữa chừng quá 60 giây đều tính là gián đoạn (chưa có cơ chế phân biệt gián đoạn thật với cố ý thoát).

---

## Open Questions

- [ ] Cách xác định học sinh "ra trường" (đang tạm bỏ qua). Hiện không có quy tắc tự xóa thông tin người giám hộ; chỉ có xóa tay.
- [ ] Cách ghi nhận sự đồng ý của người giám hộ: hệ thống ghi nhận, hay trường làm ngoài hệ thống?
- [ ] Giới hạn gói miễn phí của Firebase (Firestore, Storage) so với nhu cầu khi triển khai thật — chưa kiểm tra.

---

## Giải thích thuật ngữ

- **BRD:** tài liệu mô tả hệ thống cần làm gì và vì sao, viết bằng ngôn ngữ nghiệp vụ, chưa nói tới cách lập trình.
- **Local:** chạy trên máy tính cá nhân của bạn, chưa đưa lên mạng cho người khác dùng.
- **Production:** chạy thật cho người dùng thật.
- **Next.js:** bộ công cụ dựng phần giao diện web (phần người dùng nhìn thấy và bấm).
- **Koa.js:** bộ công cụ dựng phần máy chủ (chương trình chạy phía sau, kiểm tra đăng nhập, chấm điểm…).
- **Firebase / Firestore / Firebase Storage:** dịch vụ của Google. Firestore là nơi lưu dữ liệu (người dùng, câu hỏi, điểm). Firebase Storage là nơi lưu file (ảnh).
- **Realtime (trực tiếp):** màn hình tự cập nhật khi có thay đổi, không cần tải lại trang.
- **Admin:** người quản trị, có quyền tạo tài khoản và quản lý dữ liệu.
- **Ngân hàng câu hỏi:** kho lưu các câu hỏi để dùng lại cho nhiều bài thi.
- **Phân quyền:** quy định ai được xem và làm những gì.
- **Dữ liệu cá nhân:** thông tin xác định được một người cụ thể (họ tên, ngày sinh, địa chỉ, số điện thoại…).
- **Phòng chờ:** màn hình học sinh đứng chờ sau khi nhập đúng mã, trước khi giáo viên phát đề.
- **Phát đề / thu bài:** giáo viên bấm "phát đề" để lớp được phép bắt đầu (học sinh tự bấm "Bắt đầu làm bài"); bấm "đóng/thu bài" để dừng nhận học sinh mới và nộp các bài đang làm dở.
- **Gián đoạn:** bài bị dừng giữa chừng không do học sinh nộp (mất mạng, sập nguồn, bị đổi máy).
- **Nhật ký (log):** bản ghi lại các sự kiện (ví dụ rời tab, đẩy máy) kèm thời điểm.
