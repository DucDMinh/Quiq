import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";

const registerHealthRoutes: RegisterRoutes = (router) => {
  router.get("/health", (ctx) => ok(ctx, { status: "ok" }));
};

export default registerHealthRoutes;
