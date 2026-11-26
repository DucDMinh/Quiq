import { questionInputSchema, questionListQuerySchema } from "@quiq/shared/questions";
import type { Context } from "koa";
import { z } from "zod";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { currentStaff, staffGuard, tenantSchoolId } from "../../http/guards";
import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  loadTeacherScope,
  updateQuestion,
} from "./service";

const questionIdSchema = z.uuid();

// id không phải uuid sẽ làm Postgres ném lỗi cú pháp (500): coi như không tìm thấy.
function questionIdOf(ctx: Context): string {
  const parsed = questionIdSchema.safeParse(ctx.params.id);
  if (!parsed.success) throw new AppError("NOT_FOUND");
  return parsed.data;
}

const scopeOf = (ctx: Context, deps: AppDeps) =>
  loadTeacherScope(deps.db, currentStaff(ctx).staffId, tenantSchoolId(ctx));

// Ngân hàng câu hỏi riêng của giáo viên (FR-020 đến FR-024): chỉ vai trò teacher, lọc theo trường + chủ sở hữu.
const registerQuestionRoutes: RegisterRoutes = (router, deps) => {
  const guard = staffGuard(deps, ["teacher"]);

  router.get("/teacher/questions", ...guard, async (ctx) => {
    const query = questionListQuerySchema.parse(ctx.query);
    ok(ctx, await listQuestions(deps.db, await scopeOf(ctx, deps), query));
  });

  router.post("/teacher/questions", ...guard, async (ctx) => {
    const input = questionInputSchema.parse(ctx.request.body);
    ok(ctx, await createQuestion(deps, await scopeOf(ctx, deps), input), 201);
  });

  router.get("/teacher/questions/:id", ...guard, async (ctx) => {
    ok(ctx, await getQuestion(deps.db, await scopeOf(ctx, deps), questionIdOf(ctx)));
  });

  router.put("/teacher/questions/:id", ...guard, async (ctx) => {
    const questionId = questionIdOf(ctx);
    const input = questionInputSchema.parse(ctx.request.body);
    ok(ctx, await updateQuestion(deps, await scopeOf(ctx, deps), questionId, input));
  });

  router.delete("/teacher/questions/:id", ...guard, async (ctx) => {
    const questionId = questionIdOf(ctx);
    await deleteQuestion(deps.db, await scopeOf(ctx, deps), questionId);
    ok(ctx, { id: questionId });
  });
};

export default registerQuestionRoutes;
