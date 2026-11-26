import { OPTION_CONTENT_MAX, QUESTION_CONTENT_MAX, QUESTION_OPTION_MAX, QUESTION_OPTION_MIN } from "./limits";

// Thông báo kiểm hợp lệ của câu hỏi, dùng chung hai phía: API trả trong `details`, web hiện ngay dưới ô.
// Ngân hàng câu hỏi chỉ dùng mã lỗi chung (VALIDATION 422, NOT_FOUND 404), nên không khai mã lỗi riêng.
export const QUESTION_MESSAGES = {
  contentRequired: "Nhập nội dung câu hỏi",
  contentTooLong: `Nội dung câu hỏi quá dài (tối đa ${QUESTION_CONTENT_MAX} ký tự)`,
  optionContentRequired: "Nhập nội dung đáp án",
  optionContentTooLong: `Nội dung đáp án quá dài (tối đa ${OPTION_CONTENT_MAX} ký tự)`,
  tooFewOptions: `Cần ít nhất ${QUESTION_OPTION_MIN} đáp án`,
  tooManyOptions: `Tối đa ${QUESTION_OPTION_MAX} đáp án`,
  noCorrectOption: "Cần ít nhất 1 đáp án đúng",
  singleSelectNeedsOneCorrect: "Câu một đáp án chỉ được có đúng 1 đáp án đúng",
  difficultyInvalid: "Chọn mức khó: Dễ, Trung bình hoặc Khó",
  pageInvalid: "Số trang không hợp lệ",
} as const;
