import { enterBodySchema } from "@quiq/shared/student";
import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";
import { enterExam, getStudentState } from "./service";
import { requireStudentSession, setStudentCookie, STUDENT_COOKIE } from "./student-session";

// Router /api dùng chung mọi module: kiểm phiên học sinh trong từng route, không router.use().
const registerStudentRoutes: RegisterRoutes = (router, deps) => {
  router.post("/student/enter", async (ctx) => {
    const { examCode, studentCode } = enterBodySchema.parse(ctx.request.body);
    const { token, examCode: canonicalCode } = await enterExam(deps, {
      examCode,
      studentCode,
      currentToken: ctx.cookies.get(STUDENT_COOKIE),
    });
    setStudentCookie(ctx, token);
    // Token chỉ nằm trong cookie HttpOnly, không bao giờ trong body.
    ok(ctx, { examCode: canonicalCode });
  });

  router.get("/student/state", async (ctx) => {
    const session = await requireStudentSession(ctx, deps, "read");
    ok(ctx, await getStudentState(deps, session));
  });
};

export default registerStudentRoutes;
