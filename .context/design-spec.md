# Design Spec: Quiq

Date: 2026-11-25 · Status: bảng màu A (teal) + chữ cái đáp án đã được chủ dự án chốt; chờ ok cuối để sang /graph
Nguồn: prototype `index.html` (thư mục gốc, 6.551 dòng, tương tác được) + `SPECIFICATIONS.md` (C-01…C-13) + `docs/specs/2026-11-25-quiq-design.md`
Tokens: `skills/react-nodejs/design-tokens.md` (đọc trước khi viết UI)

## 0. Design Read, dials, nguyên tắc

**Design Read:** *Reading this as: ứng dụng thi trắc nghiệm đa trường cho học sinh/sinh viên và cán bộ nhà trường, ngôn ngữ giao diện vui, nổi khối (nút có "lip" 3D, ô đáp án màu kèm chữ cái lớn), nghiêng về Tailwind + Radix/shadcn primitives với token lấy từ prototype.*

**Dials:** `DESIGN_VARIANCE 3` (ứng dụng nghiệp vụ, cần nhất quán), `MOTION_INTENSITY 2` (chỉ phản hồi trạng thái), `VISUAL_DENSITY 5` (bảng quản trị dày, màn thi thoáng). Lý do: tín hiệu "trust-first, nhiều bảng dữ liệu" trong taste-skill §1.A; màn thi cần tập trung nên thoáng.

**Nguyên tắc cố định (taste-skill §14 + ui-ux-pro-max):**
1. **Một hệ thiết kế:** Tailwind + Radix/shadcn primitives. Thư viện khác chỉ ở vai trò không có giao diện riêng (TanStack Table, react-hook-form, zod, date-fns). Không trộn MUI/Ant. (Chủ dự án nói "kết hợp nhiều thư viện": xem D-11.)
2. **Không em-dash** (`—`) trong mọi chữ hiển thị. Dùng `:`, `·` hoặc xuống dòng. Prototype có 38 dòng chứa em-dash, phải sửa.
3. **Không dùng emoji làm icon.** Icon từ Tabler Icons (cùng phong cách nét mảnh với prototype). Ô đáp án dùng huy hiệu chữ cái A B C D (không dùng hình hình học).
4. Màu không phải kênh duy nhất: ô đáp án luôn có chữ cái; trạng thái luôn có chữ, không chỉ màu.
5. Ring focus theo token mới (`--focus-ring`), không dùng vàng. Mọi nút chỉ-icon có `aria-label`.
6. Chữ số, điểm, mã, đồng hồ: `font-mono` + `tabular-nums`.
7. Mọi màn có đủ 3 trạng thái: loading (skeleton, không spinner toàn trang), empty (có câu hướng dẫn việc kế tiếp), error (đặt gần chỗ lỗi + nút thử lại).
8. Không hiển thị mã yêu cầu nội bộ (FR-xxx) trong chữ giao diện (prototype có vài chỗ).
9. **Giao diện chỉ cho máy tính.** Mọi màn dùng một quy tắc responsive chung (xem §1).
10. Văn bản tiếng Việt có dấu đầy đủ, giọng thân thiện và ngắn; nút bắt đầu bằng động từ ("Phát đề", "Nộp bài").

## 1. Responsive (áp dụng cho mọi màn)

| Chiều rộng | Hành vi |
|---|---|
| ≥ 1280 | Bố cục đầy đủ, nội dung giới hạn theo `--layout-*-max`, căn giữa |
| 1024 đến 1279 | Cùng bố cục; sidebar giữ 276px, bảng cuộn ngang trong khung `table-wrap` (không cuộn cả trang) |
| < 1024 | Toàn màn hiện thông báo: "Quiq chỉ hỗ trợ máy tính. Hãy mở bằng laptop hoặc máy bàn (màn hình rộng từ 1024px)." Không render nội dung thi. Ngoại lệ: trang tra cứu điểm vẫn hiển thị được vì chỉ là bảng đọc |

Prototype có nhánh 720px (xếp dọc kiểu mobile): **bỏ**. Đang thi mà cửa sổ bị thu nhỏ dưới 1024 thì hiện cảnh báo chặn nội dung, đồng hồ vẫn chạy (không tạm dừng).

## 2. Khác biệt prototype ↔ spec (cần chủ dự án quyết hoặc xác nhận)

| ID | Prototype đang làm | Đề xuất trong thiết kế chính thức | Cần quyết? |
|---|---|---|---|
| D-1 | Thương hiệu bám sát một sản phẩm quiz nổi tiếng: tím `#46178f`, ô đáp án 4 màu + 4 hình hình học, dấu "!" trong tên, 15 dòng nhắc "Kahoot" hoặc "Game PIN" | **Đã quyết:** chủ dự án lấy ý tưởng từ sản phẩm đó nhưng muốn khác biệt → đổi sang bảng màu **A teal** (`#0f766e`) với đáp án hồng đậm/chàm/hổ phách/xanh lá; bỏ 4 hình, dùng huy hiệu chữ cái A B C D; bỏ hình trang trí nền; xóa chữ "Kahoot"/"Game PIN" ("Mã bài thi"); bỏ dấu "!" khỏi tên. Giữ kỹ thuật nút nổi khối | Đã quyết |
| D-2 | Có "Mở nhanh tài khoản mẫu", "Mã bài thi & Học sinh mẫu", nút giả lập "Rời tab", "Gián đoạn >60 giây", khối "Kiểm thử giám sát" | **Xóa khỏi sản phẩm.** Dữ liệu mẫu chỉ nằm trong seed/test. Rời tab, mất kết nối là sự kiện thật từ trình duyệt | Không |
| D-3 | Nhập học sinh và xuất điểm bằng **CSV** | Nhập nhận `.xlsx` và `.csv` (UTF-8, có BOM); xuất điểm **`.xlsx`** (BRD FR-062 ghi Excel) | Đã quyết |
| D-4 | "Đánh dấu xem lại" cho từng câu (client) | Giữ, chỉ lưu ở trình duyệt, không gửi server. BRD không đòi nhưng hỗ trợ FR-042 | Đã quyết |
| D-5 | Ô đáp án chưa chọn bị làm mờ sau khi chọn | Chỉ làm mờ khi **câu chọn 1**. Câu chọn nhiều đáp án không làm mờ (tránh hiểu nhầm là đã khóa) | Không |
| D-6 | Có màu và hình thứ 5 (lục giác) | BRD chỉ có A, B, C, D. Trình soạn câu hỏi cho **2 đến 4 đáp án**, ô E chưa dùng | Đã quyết |
| D-7 | Chữ "FR-044", "FR-045", "FR-047" xuất hiện trong giao diện | Xóa | Không |
| D-8 | Các màn còn thiếu trong prototype | Thiết kế mới ở §6 (bị đẩy máy, gián đoạn, mất mạng, vi phạm toàn màn hình, hết giờ tự nộp, phiên hết hạn, trường bị khóa, 404) | Không |
| D-9 | Bảng điểm lớp năm cũ | Hiện họ tên + mã (C-05), ẩn ngày sinh, quê quán, địa chỉ, người giám hộ | Đã quyết |
| D-10 | Tiêu đề tab "Quiq! — Thi trắc nghiệm…" có em-dash và dấu "!" | `Quiq | Thi trắc nghiệm trực tuyến` | Không |
| D-11 | Chủ dự án muốn "kết hợp nhiều thư viện" | Một hệ thiết kế (Tailwind + Radix/shadcn), các thư viện khác chỉ làm phần không có giao diện riêng, xem nguyên tắc 1 | Đã quyết |

## 3. Thành phần dùng chung

| Thành phần | Quy cách |
|---|---|
| **Nút** | 6 biến thể: primary (teal), secondary (trắng viền), subtle (xám), success (xanh lá), danger (đỏ `--quiq-red`), danger-outline. 3 cỡ 36/42/50px. Có "lip" cạnh dưới, nhấn dịch xuống 2px. Disabled: 48% độ mờ + `cursor: not-allowed` + giải thích bằng `title`/hint khi lý do không hiển nhiên. Đang xử lý: đổi nhãn "Đang lưu…" và khóa nút, không đổi kích thước |
| **Input, select, textarea** | Nhãn luôn hiện phía trên (không placeholder thay nhãn), dấu `*` cho trường bắt buộc, hint dưới nhãn, lỗi ngay dưới ô (chữ `--status-danger-text`, kèm icon) |
| **Badge** | 6 loại: brand, success, warning, danger, info, neutral. Luôn có chữ |
| **Thẻ (card)** | Nền trắng, viền `--border-subtle`, `--shadow-card`, bo `--radius-md`. Tránh lồng thẻ trong thẻ |
| **Thẻ KPI** | Nhãn nhỏ, số lớn mono, dòng phụ; viền dưới 4px |
| **Bảng** | Trong `table-wrap` (cuộn ngang riêng), header cố định khi cuộn dọc, cột cuối là "Thao tác" căn phải. Từ 50 dòng: phân trang 25/trang + ô tìm kiếm. Dòng trống: empty-state có nút hành động chính |
| **Dialog** | Radix Dialog, tiêu đề + nội dung + chân (Hủy/Xác nhận), đóng bằng Esc và nút ×, trả focus về nút mở. Dialog xóa: nêu rõ đối tượng và hậu quả, nút xác nhận màu đỏ |
| **Toast** | Góc dưới phải, `aria-live="polite"`, tự tắt sau 5 giây (lỗi: 8 giây, có nút đóng) |
| **Alert** | 5 loại (success, info, warning, danger, neutral), icon + chữ, nằm trong luồng nội dung |
| **Tabs** | Radix Tabs, mũi tên trái/phải đổi tab |
| **App shell (cán bộ)** | Sidebar 276px bên trái (logo, menu theo vai trò, khối người dùng + đăng xuất ở chân), vùng nội dung bên phải, tiêu đề trang + phụ đề |
| **Portal shell (công khai, học sinh)** | Topbar (logo, điều hướng pill), nội dung căn giữa, nền phẳng `--bg-portal` (không hình trang trí) |
| **Exam shell** | Topbar teal cố định (tên bài, thí sinh, cảnh báo, đồng hồ, nút Nộp bài) + thân 2 cột (câu hỏi | danh sách câu 310px) |
| **Đồng hồ thi** | Pill mono `mm:ss`. Còn ≤ 120 giây: nền hồng đậm `--quiq-rose` + viền trắng + `aria-live="assertive"` thông báo ở mốc 5 phút, 1 phút. Hiển thị theo giờ máy chủ (client chỉ đếm lùi từ `ends_at`) |
| **Skeleton** | Khối xám nhạt đúng kích thước nội dung thật, không nhấp nháy khi `prefers-reduced-motion` |

## 4. Màn hình công khai (không đăng nhập)

### 4.1 Vào thi · `/thi` và `/thi/[mã]` · FR-040
- **Layout:** Portal shell. Thẻ trung tâm rộng tối đa 780px: tiêu đề, 2 ô (Mã bài thi hoặc đường dẫn; Mã học sinh/sinh viên), nút "Vào phòng chờ" (primary, lg). Mở bằng link `/thi/[mã]`: ô mã bài thi đã điền và khóa, con trỏ ở ô mã học sinh.
- **Thành phần:** thẻ, 2 input, alert lỗi, nút. Xóa khối "Học sinh mẫu" (D-2).
- **States:** loading (nút "Đang kiểm tra…"); error: "Không tìm thấy bài thi" (mã sai), "Mã học sinh không đúng hoặc không thuộc lớp được gán" (cùng một thông điệp cho mã sai và mã vô hiệu), "Trường đã bị khóa", "Bài thi chưa sẵn sàng". Mã bài thi không phân biệt hoa thường, bỏ khoảng trắng; dán cả link vẫn nhận.
- **Tương tác:** Enter gửi form; sai quá giới hạn thì hiện "Bạn thử quá nhiều lần, thử lại sau X giây" (429).

### 4.2 Đăng nhập cán bộ · `/dang-nhap` · FR-002, FR-010
- **Layout:** Portal shell, thẻ 2 ô (tên đăng nhập, mật khẩu có nút hiện/ẩn), nút "Đăng nhập". Xóa "Mở nhanh tài khoản mẫu" (D-2).
- **States:** lỗi chung "Tên đăng nhập hoặc mật khẩu không đúng" (không tiết lộ ô nào sai); "Trường của bạn đang bị khóa"; 429 khi thử sai nhiều.
- **Tương tác:** đăng nhập xong chuyển theo vai trò: `/admin-tong`, `/quan-tri`, `/giao-vien`.

### 4.3 Tra cứu điểm · `/tra-cuu` · FR-064
- **Layout:** Portal shell. Thẻ lọc 3 ô nằm một hàng (Trường: select có tìm kiếm; Mã học sinh; Năm học, mặc định năm hiện tại) + nút "Tra cứu". Dưới là bảng kết quả.
- **Bảng:** Môn học · Bài thi · Mã bài thi · Điểm chính thức (cao nhất, mono). Không họ tên, không ngày sinh, không địa chỉ, không SĐT.
- **States:** empty "Chưa có bài thi nào được công bố bảng điểm" (cũng dùng khi mã sai/vô hiệu, cùng một thông điệp); loading skeleton; error + thử lại. Trường bị khóa vẫn tra được (C-09).
- **Tương tác:** điểm hiển thị là điểm hiện tại, tự đúng nếu giáo viên chấm lại.

## 5. Học sinh (không tài khoản) · cookie phiên `quiq_stu`

### 5.1 Phòng chờ · `/thi/[mã]/phong-cho` · FR-033, FR-043
- **Layout:** Portal shell, thẻ hero 780px: badge môn + badge "Mã bài thi: XXXX"; tên bài; badge trạng thái lớp (Chưa phát đề / Đã phát đề / Đã thu bài). 2 ô thông tin: Thí sinh (họ tên, mã · lớp) và Lượt thi (số phút · số câu; "Lượt sắp làm: n/N · Cảnh báo tối đa: M"). Alert theo trạng thái. Nút "Bắt đầu làm bài" (success, lg, 220px). Nút phụ "Rời phòng chờ".
- **Trạng thái và alert:**
  - Chưa phát đề (warning): "Đang chờ giáo viên phát đề cho lớp X. Mã của bạn chưa bị khóa ở phòng chờ." Nút khóa.
  - Đã phát đề (success): "Giáo viên đã phát đề. Đồng hồ chỉ bắt đầu khi bạn bấm Bắt đầu làm bài. Cần bật chế độ toàn màn hình." Nút bật.
  - Đã thu bài (danger): "Giáo viên đã đóng và thu bài. Bạn không thể bắt đầu lượt mới." Nút khóa.
  - Hết lượt (danger): "Bạn đã dùng hết N/N lượt làm bài." Nút khóa.
  - Đã hoàn thành (info): "Bạn đã hoàn thành bài này." dẫn về trang kết quả.
- **Tương tác:** trang tự cập nhật trạng thái lớp (không cần tải lại, qua heartbeat 5 giây); khi giáo viên phát đề nút bật và có thông báo âm thầm (không âm thanh). Bấm "Bắt đầu làm bài" yêu cầu fullscreen (nếu trình duyệt từ chối: hiện hướng dẫn, không bắt đầu).
- **Đẩy máy khi còn ở phòng chờ:** không tốn lượt (xem 6.1).

### 5.2 Làm bài · `/thi/[mã]/lam-bai` · FR-036, 041, 042, 044, 045
- **Layout:** Exam shell toàn màn hình. Topbar teal: bên trái tên bài + "Thí sinh: tên (mã) · Lần làm k/N"; bên phải badge "Cảnh báo n/M", đồng hồ, nút "Nộp bài (đã trả lời/tổng)" (success). Thân 2 cột (≤ 1280px, gap 24): trái là thẻ câu hỏi, phải (310px) là danh sách câu hỏi.
- **Thẻ câu hỏi:** badge "Câu i / tổng" + badge "Chọn 1 đáp án đúng" / "Chọn nhiều đáp án đúng"; nút "Đánh dấu xem lại" (D-4); nội dung câu (display 20px/800, lưu ý hiển thị xuống dòng và chuỗi dài); ảnh trong khung `question-media-frame` (tải qua proxy, có `alt`, giữ chỗ trước khi tải để không giật bố cục); lưới đáp án 2 cột, mỗi ô tối thiểu 82px: huy hiệu chữ cái A B C D (ô bo tròn) + nội dung + dấu tick và viền trắng 3px khi chọn; ô A hồng đậm, B chàm, C hổ phách (chữ tối), D xanh lá. Chân: "Câu trước" / "Câu tiếp".
- **Danh sách câu:** lưới 5 cột nút số; trạng thái: hiện tại (viền teal đậm), đã trả lời (nền teal), chưa trả lời (trắng), đánh dấu (góc cờ đỏ). Dưới: "Đã trả lời a/b câu" và ghi chú thứ tự đã xáo.
- **States:** loading đề (skeleton); lưu đáp án thất bại (chấm vàng nhỏ cạnh ô + banner "Mất kết nối, đang thử lại", đáp án giữ trong hàng đợi, xem 6.3); hết giờ (6.4).
- **Tương tác:** chọn đáp án lưu ngay (PUT theo câu); phím 1 đến 4 hoặc A đến D chọn đáp án, mũi tên trái/phải chuyển câu; Enter trên "Nộp bài" mở dialog xác nhận "Bạn còn k câu chưa trả lời. Nộp bài?" (nêu số câu chưa làm và số câu đánh dấu). Không có nút nào để tự "đổi máy" hay "dừng giờ".
- **Chống gian lận:** bắt `visibilitychange`, `fullscreenchange`, `blur`; xem 6.2. Không khóa chuột phải hay dán (không nằm trong BRD).

### 5.3 Kết quả · `/thi/[mã]/ket-qua` · FR-046, FR-047
- **Layout:** Portal shell 860px. Thẻ hero: badge "Đã hoàn thành bài thi", tên (mã), "Lý do kết thúc: Đã nộp bài / Hết giờ / Vi phạm quy chế / Giáo viên thu bài · Lượt #k". Bên phải khối điểm nền teal đậm `--quiq-brand-dark`: "Điểm lần thi này" nhãn `--on-brand-dark-label`, **điểm lớn mono (2 chữ số thập phân)**, "Đúng a/b câu (thang 10)". Hàng dưới: ghi chú "Đóng trang này thì không có nơi khác để xem lại đáp án" + nút "Xem đáp án" (primary, luôn hiện).
- **Xem đáp án:** chưa công bố → alert danger "Giáo viên chưa công bố đáp án" tại chỗ, không lộ gì; đã công bố → mở khối "Đề thi và đáp án đúng": từng câu có ảnh, 4 đáp án dạng mini, đáp án đúng có badge "Đúng" và viền xanh (không hiển thị câu mình đã chọn, đúng spec).
- **Ngoại lệ:** lần làm bị gián đoạn **không có** trang này (học sinh không thấy điểm lần đó): xem 6.3.
- **Nút thoát:** "Thoát về cổng chính".
- **Tương tác:** điểm hiện ngay sau khi hoàn thành; làm lại nếu đủ điều kiện thì không có nút tại đây (làm lại chỉ qua phòng chờ khi bị gián đoạn).

## 6. Màn và trạng thái còn thiếu trong prototype (thiết kế mới)

### 6.1 Bị đẩy máy · FR-043
Toàn màn (chặn nội dung), icon cảnh báo, tiêu đề "Mã của bạn vừa được dùng ở thiết bị khác", giải thích: "Bài làm ở máy này đã dừng và được chấm theo các câu bạn đã chọn. Nếu đó không phải bạn, hãy báo giáo viên." Nút "Về trang vào thi". Hiện trong ≤ 5 giây sau khi phiên bị thu hồi (heartbeat). Không hiện điểm.

### 6.2 Cảnh báo vi phạm · FR-044
Dialog bắt buộc xác nhận (không đóng bằng Esc): "Cảnh báo n/M: bạn vừa rời khỏi trang thi hoặc thoát toàn màn hình. Thêm 1 lần nữa, bài sẽ tự nộp." (dòng cuối đổi theo n). Nút "Quay lại làm bài" bật lại fullscreen. Khi quá ngưỡng: màn "Bài đã được tự nộp do vi phạm quy chế thi" rồi chuyển sang trang kết quả với lý do. Badge cảnh báo trên topbar chuyển đỏ khi n ≥ 1.

### 6.3 Mất mạng và gián đoạn · FR-045
- **Ngắn (< ngưỡng):** banner vàng dưới topbar "Mất kết nối. Đang thử lại, bài làm vẫn được giữ trong máy này." Đồng hồ vẫn chạy. Khi có lại mạng: banner xanh 3 giây "Đã kết nối lại", đáp án chờ gửi được đẩy lên.
- **Quá ngưỡng (đã bị coi là gián đoạn khi quay lại):** màn "Lần làm này đã bị gián đoạn" nêu: "Bài đã được chấm theo các câu bạn đã chọn (bạn không xem điểm lần này)", "Bạn còn k lượt." Nút "Về phòng chờ" (nếu còn lượt, và lớp chưa thu bài) hoặc "Thoát" (hết lượt/đã thu bài). Không hiển thị điểm.

### 6.4 Hết giờ tự nộp · FR-041
Dialog không thể đóng "Hết giờ. Bài của bạn đang được nộp…" rồi tự chuyển sang trang kết quả (lý do "Hết giờ"). Cảnh báo trước ở mốc 5 phút và 1 phút (toast + thông báo đọc màn hình).

### 6.5 Khác
| Màn | Nội dung |
|---|---|
| Phiên cán bộ hết hạn | Dialog "Phiên đăng nhập đã hết hạn" → `/dang-nhap`, giữ lại trang đang xem để quay về |
| Trường bị khóa | Cán bộ: "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống." Học sinh: không vào thi được, vẫn tra cứu |
| 403/404 | Một trang chung "Không tìm thấy trang". Truy cập chéo trường cũng hiện 404 (không lộ sự tồn tại) |
| Màn hẹp < 1024 | Thông báo ở §1 |
| Mất kết nối SSE (giáo viên) | Badge "Đang kết nối lại…" cạnh tiêu đề phòng thi; dữ liệu cũ mờ đi cho tới khi nhận ảnh chụp mới |

## 7. Admin tổng · `/admin-tong` · FR-001 đến FR-005

Menu: Thống kê tổng hợp · Quản lý trường học · Tài khoản Admin trường. Không có mục nào chạm dữ liệu riêng của trường (FR-004); alert info cố định ở trang thống kê nói rõ "Chỉ hiển thị số liệu tổng hợp".

### 7.1 Thống kê · FR-003
4 thẻ KPI (Tổng số trường, giáo viên, học sinh, lượt làm bài). Bảng "Số liệu tổng hợp từng trường": Trường · Mã · Trạng thái · Số lớp · Số giáo viên · Số học sinh · Số câu hỏi · Số bài thi · Số lượt thi. Chỉ số, không tên/điểm cụ thể. Empty: "Chưa có trường nào" + nút "Tạo trường".

### 7.2 Quản lý trường
Bộ lọc pill: Tất cả (n) · Đang hoạt động · Đã khóa. Bảng: Tên · Mã · Ngày tạo · Quy chế mặc định (3 lần / 2 cảnh báo / 60 giây) · Trạng thái · Thao tác (Khóa/Mở khóa). Nút "Tạo trường" mở dialog (tên, mã trường). Khóa trường có dialog xác nhận nêu hệ quả ("Giáo viên và admin của trường không đăng nhập được, học sinh không vào thi được, vẫn tra cứu được điểm").

### 7.3 Tài khoản Admin trường
Lọc theo trường. Bảng: Họ tên · Tên đăng nhập · Trường phụ trách · Trạng thái trường · Thao tác (Đặt lại mật khẩu). Dialog "Tạo tài khoản Admin trường" (chọn trường, họ tên, tên đăng nhập, mật khẩu tối thiểu 8 ký tự) và "Đặt lại mật khẩu" (hiện mật khẩu mới đúng một lần, có nút sao chép).

## 8. Admin trường · `/quan-tri` · FR-010 đến FR-018

Menu: Môn học · Giáo viên · Năm học & Lớp · Học sinh · Phân công & Quy chế · Kho dữ liệu chỉ đọc.

| Màn | Nội dung chính |
|---|---|
| **Môn học** (FR-018) | Bảng: Tên môn · Số giáo viên đang gắn · Số câu hỏi · Thao tác (Đổi tên, Xóa). Xóa môn đang dùng: nút khóa + tooltip "Môn đang có giáo viên/câu hỏi/bài thi" (C-08) |
| **Giáo viên** (FR-010) | Bảng: Họ tên · Tên đăng nhập · **Môn cố định** · Lớp phụ trách (năm hiện tại) · Đặt lại mật khẩu. Dialog tạo: chọn môn từ danh sách, ghi chú "Môn không đổi được sau khi tạo". Không có nút đổi môn |
| **Năm học & Lớp** (FR-012) | Thanh pill chọn năm học; bảng lớp: Tên lớp · Năm học · Sĩ số · GV phân công. Nút "Tạo năm học", "Tạo lớp", "Lên lớp cho học sinh" (dialog chọn lớp nguồn → lớp đích, xem trước số học sinh, giữ lịch sử) |
| **Học sinh** (FR-011, 016, 017) | Bảng: Mã · Họ tên · Lớp · Ngày sinh & Quê quán · Địa chỉ · Người giám hộ · Thao tác (Lịch sử lớp, Sửa, **Xóa dữ liệu cá nhân**). Nhập file: dialog có tải mẫu `.xlsx`, chọn file `.xlsx/.csv`, xem trước + báo lỗi theo số dòng, nút "Nhập" chỉ bật khi file không lỗi (cả file hoặc không). "Xóa dữ liệu cá nhân" thay cho "Xóa ẩn danh": dialog nêu rõ: xóa họ tên, ngày sinh, quê quán, địa chỉ, người giám hộ; giữ điểm; **mã không dùng lại**; yêu cầu gõ mã học sinh để xác nhận |
| **Phân công & Quy chế** (FR-013, 014) | Thẻ "Quy chế thi toàn trường" với **3 ô**: số lần làm bài tối đa (mặc định 3), số lần cảnh báo gian lận (mặc định 2), ngưỡng gián đoạn tính bằng giây (mặc định 60); ghi chú "Chỉ áp dụng cho lớp được phát đề sau khi lưu". Bảng phân công: Giáo viên · Môn · Lớp · Gỡ. Dialog "Phân công" chọn giáo viên + lớp (môn tự theo giáo viên) |
| **Kho dữ liệu chỉ đọc** (FR-015) | 3 tab: Ngân hàng câu hỏi · Đề thi và bài thi · Bảng điểm tổng hợp; lọc theo giáo viên. Mọi thao tác sửa/xóa không tồn tại; banner "Chỉ xem" cố định |

## 9. Giáo viên · `/giao-vien` · FR-020 đến FR-039, FR-060 đến FR-065

Menu: Ngân hàng câu hỏi · Bài thi · Phòng thi · Kết quả · Học sinh lớp phụ trách. Tiêu đề trang luôn nêu môn cố định.

### 9.1 Ngân hàng câu hỏi · FR-020 đến 024
4 thẻ KPI (Tổng, Dễ, Trung bình, Khó); lọc pill theo mức; danh sách câu: nội dung rút gọn 2 dòng, badge mức, ảnh thu nhỏ, đáp án đúng. Dialog soạn câu hỏi (rộng): nội dung, tải ảnh (tối đa 2 MB; jpeg/png/webp; có xem trước + nhập mô tả `alt`), 2 đến 4 đáp án (D-6), đánh dấu 1 hoặc nhiều đáp án đúng (công tắc "Cho phép chọn nhiều đáp án"), chọn mức khó. Lỗi: "Cần ít nhất 1 đáp án đúng". Empty: "Chưa có câu hỏi nào" + nút "Thêm câu hỏi".

### 9.2 Bài thi và rút đề · FR-030 đến 032
Bảng (lọc theo năm học): Tên bài · **Mã bài thi** + link (nút sao chép) · Cấu hình đề (tổng/dễ/TB/khó) · Lớp được gán · Lượt thi · Thao tác (Xem đề, Phòng thi, Xóa). Xóa bị khóa khi đã có người thi, tooltip nêu lý do (BR-002). Dialog "Tạo bài thi": tên, thời gian (phút), tổng số câu + số câu dễ/TB/khó (hiện **số câu hiện có theo mức** ngay cạnh ô, lỗi tại chỗ nếu thiếu: "Ngân hàng chỉ có 8 câu Khó, cần 10"), chọn lớp (checkbox, chỉ lớp trong phân công của mình, năm hiện tại). "Xem đề" mở bản sao câu hỏi của đề.

### 9.3 Phòng thi · điều khiển theo lớp · FR-033 đến 038, FR-035
- **Layout:** hàng chọn (Bài thi, Lớp, nút "Sao chép mã bài thi"); hàng nút điều khiển của lớp: "Phát đề cho lớp X" (primary), "Đóng / Thu bài lớp X" (danger), "Công bố đáp án" và "Công bố bảng điểm" (hai nút riêng; sau khi bấm đổi thành badge "Đã công bố"). 4 thẻ KPI trực tiếp: Đang chờ (vàng) · Đang làm (xanh dương) · Đã nộp (xanh lá) · Chưa vào thi (xám). Bảng học sinh lớp: Mã · Họ tên · Trạng thái (badge) · Lượt làm · Cảnh báo · Điểm cao nhất · Chi tiết.
- **Trạng thái dẫn xuất:** Chưa làm, Đang chờ, Đang làm, Đã nộp, và cờ "Gián đoạn" (badge đỏ).
- **Tương tác:** Phát đề/Thu bài/Công bố đều qua dialog xác nhận (thu bài nêu "N học sinh đang làm sẽ bị nộp ngay"); cập nhật trực tiếp qua SSE (không tải lại), nhấp nháy nền hàng 1 lần khi đổi trạng thái (tắt khi reduced-motion). Nút "Chi tiết" mở 9.5.
- **States:** chưa có bài thi (empty + dẫn tới 9.2); mất SSE (6.5).

### 9.4 Kết quả, thống kê, chấm lại · FR-039, 060 đến 062
3 ô lọc (Năm học phân công, Lớp, Bài thi). 3 tab: **Bảng điểm cả lớp** (Mã · Họ tên · Số lần làm · Chi tiết các lần · Điểm chính thức · Bài làm & Nhật ký; nút "Xuất Excel" `.xlsx`: điểm chính thức + số lần làm, không chi tiết từng lần); **Thống kê câu hay sai** (xếp theo tỷ lệ làm sai, thanh tỷ lệ kèm số %, không chỉ màu); **Sửa đáp án và chấm lại** (làm trên bản sao đề; sau khi lưu, dialog báo "Sẽ chấm lại n bài. Lựa chọn của học sinh không đổi", rồi toast kết quả). Lớp năm trước: chỉ điểm (tên + mã theo C-05), không thông tin cá nhân khác.

### 9.5 Chi tiết bài làm và nhật ký · FR-065
Tiêu đề: tên học sinh, mã, các lần làm (tab hoặc danh sách). Mỗi lần: thời điểm bắt đầu/kết thúc, lý do kết thúc, điểm, các câu đã chọn đúng/sai; nhật ký vi phạm (rời tab/thoát toàn màn hình, thời điểm); nhật ký đẩy máy (thời điểm, mã). Giáo viên thấy cả điểm lần gián đoạn.

### 9.6 Học sinh lớp phụ trách · FR-063
Lọc Năm học + Lớp. Bảng: Mã · Họ tên · Lớp · Người giám hộ · SĐT người giám hộ · Điểm các bài thi trong năm. **Không** có cột ngày sinh/quê quán/địa chỉ. Với năm học trước: chỉ còn cột điểm, ẩn cột người giám hộ và SĐT.

## 10. Hộp thoại (dialog) cần có

Tạo trường · Tạo admin trường · Đặt lại mật khẩu · Tạo giáo viên · Lên lớp cho học sinh · Thêm/sửa học sinh · Nhập học sinh từ file · Xóa dữ liệu cá nhân học sinh · Soạn câu hỏi · Tạo bài thi · Xác nhận phát đề/thu bài/công bố · Xác nhận nộp bài (học sinh) · Cảnh báo vi phạm · Hết giờ.

## 11. Accessibility (kiểm cho mọi màn)

Tab theo thứ tự hợp lý, ring focus thấy rõ; dialog bẫy focus và trả focus; bảng dùng `<th scope>`; trạng thái và lỗi đọc được bằng trình đọc màn hình (`aria-live`); đồng hồ thi không đọc từng giây (chỉ đọc ở mốc 5 phút, 1 phút, 30 giây); ảnh câu hỏi có `alt` do giáo viên nhập (bắt buộc ở bước soạn, có thể "ảnh minh họa không mang thông tin"); tôn trọng `prefers-reduced-motion`. Contrast đã đo ở tokens.

## 12. Pre-flight (taste-skill §14) đối với bản spec này

- [x] Design Read + dials có lý do · [x] một hệ thiết kế · [x] không em-dash trong chữ giao diện (quy tắc ghi ở §0.2, phải kiểm lại khi build) · [x] một chủ đề sáng, một hệ góc bo, một màu nhấn teal
- [x] Contrast nút và chữ đã đo, ring focus đã sửa · [x] có empty/loading/error cho mọi màn · [x] icon từ thư viện cho phép, đáp án dùng huy hiệu chữ cái, không dùng hình
- [ ] **Chưa kiểm được ở bước spec:** chữ giao diện thực tế (em-dash, ngữ pháp), Core Web Vitals, hiệu ứng thực. Reviewer kiểm lại khi có UI.
- Mục chưa áp dụng cho ứng dụng nghiệp vụ (hero, marquee, bento, logo wall, v.v.): bỏ qua có chủ đích.
