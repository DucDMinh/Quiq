import { attemptIdParamsSchema, saveAnswerBodySchema } from "@quiq/shared/student";
import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";
import { requireStudentSession } from "../student/student-session";
import { getAttemptAnswers } from "./answers";
import { getPaper, getResult, saveAnswer, startAttempt, submitAttempt } from "./service";

// Router /api dùng chung mọi module: kiểm phiên học sinh trong từng route, không router.use() (sẽ chặn cả route khác).
const registerAttemptRoutes: RegisterRoutes = (router, deps) => {
  router.post("/student/attempts", async (ctx) => {
    const session = await requireStudentSession(ctx, deps, "active");
    ok(ctx, await startAttempt(deps, session), 201);
  });

  router.get("/student/attempts/:id", async (ctx) => {
    const { id } = attemptIdParamsSchema.parse(ctx.params);
    const session = await requireStudentSession(ctx, deps, "active");
    ok(ctx, await getPaper(deps, session, id));
  });

  router.put("/student/attempts/:id/answers", async (ctx) => {
    const { id } = attemptIdParamsSchema.parse(ctx.params);
    const body = saveAnswerBodySchema.parse(ctx.request.body);
    const session = await requireStudentSession(ctx, deps, "active");
    ok(ctx, await saveAnswer(deps, session, id, body));
  });

  // "read": phiên đã bị thu hồi do lần nộp trước vẫn nộp lại được (idempotent, trả kết quả cũ).
  router.post("/student/attempts/:id/submit", async (ctx) => {
    const { id } = attemptIdParamsSchema.parse(ctx.params);
    const session = await requireStudentSession(ctx, deps, "read");
    ok(ctx, await submitAttempt(deps, session, id));
  });

  router.get("/student/attempts/:id/result", async (ctx) => {
    const { id } = attemptIdParamsSchema.parse(ctx.params);
    const session = await requireStudentSession(ctx, deps, "read");
    ok(ctx, await getResult(deps, session, id));
  });

  // Đề + đáp án đúng khi lớp đã công bố (FR-047). Khác PUT cùng đường dẫn (lưu lựa chọn khi đang làm).
  router.get("/student/attempts/:id/answers", async (ctx) => {
    const { id } = attemptIdParamsSchema.parse(ctx.params);
    const session = await requireStudentSession(ctx, deps, "read");
    ok(ctx, await getAttemptAnswers(deps, session, id));
  });
};

export default registerAttemptRoutes;
