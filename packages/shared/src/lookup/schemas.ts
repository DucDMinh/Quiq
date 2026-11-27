import { z } from "zod";
import { normalizeStudentCode } from "../student/schemas";

const MAX_CODE_LENGTH = 64;

export const lookupSchoolParamsSchema = z.object({ schoolId: z.uuid() });

/** Tra cứu điểm (FR-064): thiếu năm học thì máy chủ dùng năm hiện tại của trường. */
export const lookupBodySchema = z.object({
  schoolId: z.uuid(),
  // So khớp mã như luồng vào thi: bỏ khoảng trắng đầu cuối, chữ hoa.
  studentCode: z
    .string()
    .transform(normalizeStudentCode)
    .pipe(z.string().min(1).max(MAX_CODE_LENGTH)),
  academicYearId: z.uuid().optional(),
});
export type LookupBody = z.input<typeof lookupBodySchema>;

/** Một trường trong ô chọn; gồm cả trường bị khóa (C-09). Không thêm thông tin nào khác. */
export interface LookupSchool {
  id: string;
  name: string;
}

export interface LookupYear {
  id: string;
  name: string;
  isCurrent: boolean;
}

/** Một dòng bảng điểm. Cố ý không có thông tin cá nhân hay id nội bộ của học sinh (BR-013). */
export interface LookupScoreRow {
  subjectName: string;
  examTitle: string;
  examCode: string;
  /** Điểm chính thức (cao nhất các lần đã chấm); không có lần nào đã chấm thì 0. */
  score: number;
}

/** Mã sai, mã vô hiệu, chưa có bài công bố: cùng một kết quả `{ items: [] }` (chống dò mã). */
export interface LookupResult {
  items: LookupScoreRow[];
}
