import { randomInt } from "node:crypto";

/** Bỏ ký tự dễ nhầm khi đọc/gõ: 0/O, 1/I/L. Học sinh nhập không phân biệt hoa thường. */
export const EXAM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const EXAM_CODE_LENGTH = 6;

export type ExamCodeGenerator = () => string;

/** Mã ngẫu nhiên bằng crypto; tính duy nhất toàn hệ thống do service kiểm và ràng buộc `exams_code_key`. */
export const randomExamCode: ExamCodeGenerator = () =>
  Array.from(
    { length: EXAM_CODE_LENGTH },
    () => EXAM_CODE_ALPHABET[randomInt(EXAM_CODE_ALPHABET.length)],
  ).join("");
