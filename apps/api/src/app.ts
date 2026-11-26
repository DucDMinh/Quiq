import Router from "@koa/router";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import type { AppDeps } from "./http/deps";
import { errorMiddleware } from "./http/middleware";
import { loadModules } from "./modules/loader";

export interface CreateAppOptions {
  /** Phụ thuộc truyền cho mọi module; server thật đưa kết nối + systemClock, test đưa PGlite + đồng hồ giả. */
  deps: AppDeps;
  /** Thư mục chứa các module (mặc định apps/api/src/modules); test truyền thư mục tạm. */
  modulesDir?: string;
}

export async function createApp(options: CreateAppOptions): Promise<Koa> {
  const app = new Koa();
  const router = new Router({ prefix: "/api" });
  await loadModules(router, options.deps, options.modulesDir);

  // errorMiddleware đứng đầu để bắt cả lỗi của bodyParser (JSON hỏng) và route.
  app.use(errorMiddleware());
  app.use(bodyParser());
  app.use(router.routes());
  return app;
}
