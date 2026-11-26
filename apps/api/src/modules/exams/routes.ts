import { createExamBodySchema, examIdParamsSchema } from "@quiq/shared/exams";
import { AppError } from "../../http/errors";
import { staffGuard } from "../../http/guards";
import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";
import { createExam } from "./create";
import { deleteExam } from "./delete";
import {
  countBank,
  getExamDetail,
  listAssignableClasses,
  listExams,
  teacherScope,
} from "./service";

/** Id không phải uuid thì cũng chỉ là "không tìm thấy" (không lộ gì thêm). */
function examIdOf(params: unknown): string {
  const parsed = examIdParamsSchema.safeParse(params);
  if (!parsed.success) throw new AppError("NOT_FOUND");
  return parsed.data.id;
}

// Đường dẫn tĩnh (/classes, /bank-counts) đăng ký TRƯỚC /:id.
const registerExamRoutes: RegisterRoutes = (router, deps) => {
  const guard = staffGuard(deps, ["teacher"]);

  router.get("/teacher/exams/classes", ...guard, async (ctx) => {
    ok(ctx, await listAssignableClasses(deps.db, teacherScope(ctx)));
  });

  router.get("/teacher/exams/bank-counts", ...guard, async (ctx) => {
    ok(ctx, await countBank(deps.db, teacherScope(ctx)));
  });

  router.get("/teacher/exams", ...guard, async (ctx) => {
    ok(ctx, await listExams(deps.db, teacherScope(ctx)));
  });

  router.post("/teacher/exams", ...guard, async (ctx) => {
    const input = createExamBodySchema.parse(ctx.request.body);
    ok(ctx, await createExam(deps, teacherScope(ctx), input), 201);
  });

  router.get("/teacher/exams/:id", ...guard, async (ctx) => {
    ok(ctx, await getExamDetail(deps.db, teacherScope(ctx), examIdOf(ctx.params)));
  });

  router.delete("/teacher/exams/:id", ...guard, async (ctx) => {
    const examId = examIdOf(ctx.params);
    await deleteExam(deps, teacherScope(ctx), examId);
    ok(ctx, { id: examId });
  });
};

export default registerExamRoutes;
