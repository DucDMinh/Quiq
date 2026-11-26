import { examClassParamsSchema } from "@quiq/shared/exams";
import { AppError } from "../../http/errors";
import { staffGuard } from "../../http/guards";
import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";
import { teacherScope } from "../exams/service";
import { getRoster } from "./roster";
import { closeClass, dispatchClass, type ExamClassRef } from "./service";
import { openRosterStream } from "./stream";

function examClassRefOf(params: unknown): ExamClassRef {
  const parsed = examClassParamsSchema.safeParse(params);
  if (!parsed.success) throw new AppError("NOT_FOUND");
  return parsed.data;
}

const BASE = "/teacher/exams/:examId/classes/:classId";

const registerClassControlRoutes: RegisterRoutes = (router, deps) => {
  const guard = staffGuard(deps, ["teacher"]);

  router.post(`${BASE}/dispatch`, ...guard, async (ctx) => {
    ok(ctx, await dispatchClass(deps, teacherScope(ctx), examClassRefOf(ctx.params)));
  });

  router.post(`${BASE}/close`, ...guard, async (ctx) => {
    ok(ctx, await closeClass(deps, teacherScope(ctx), examClassRefOf(ctx.params)));
  });

  router.get(`${BASE}/roster`, ...guard, async (ctx) => {
    ok(ctx, await getRoster(deps, teacherScope(ctx), examClassRefOf(ctx.params)));
  });

  router.get(`${BASE}/stream`, ...guard, async (ctx) => {
    await openRosterStream(ctx, deps, teacherScope(ctx), examClassRefOf(ctx.params));
  });
};

export default registerClassControlRoutes;
