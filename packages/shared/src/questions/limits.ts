// Giới hạn của ngân hàng câu hỏi, dùng chung cho schema (API + web) và chữ trong thông báo lỗi.
export const QUESTION_CONTENT_MAX = 5000;
export const OPTION_CONTENT_MAX = 1000;
export const QUESTION_OPTION_MIN = 2;
export const QUESTION_OPTION_MAX = 4;

/** Số câu mỗi trang của danh sách ngân hàng (design-spec §3: phân trang 25/trang). */
export const QUESTION_PAGE_SIZE = 25;
/** Trang lớn nhất nhận ở query: chặn offset vô lý (25 x 10000 câu đã vượt xa một ngân hàng thật). */
export const QUESTION_PAGE_MAX = 10000;
