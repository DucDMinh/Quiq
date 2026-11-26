import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type Router from "@koa/router";

/** Mỗi modules/<tên>/routes.ts export default một hàm như thế này; đường dẫn tính từ /api. */
export type RegisterRoutes = (router: Router) => void;

const BUILT_IN_MODULES_DIR = dirname(fileURLToPath(import.meta.url));

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Tự quét <modulesDir>/*\/routes.ts và đăng ký vào router, theo thứ tự tên thư mục.
 * Task sau chỉ cần thêm thư mục module, không sửa file đăng ký chung.
 */
export async function loadModules(
  router: Router,
  modulesDir: string = BUILT_IN_MODULES_DIR,
): Promise<string[]> {
  const entries = await readdir(modulesDir, { withFileTypes: true });
  const moduleNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const loaded: string[] = [];
  for (const name of moduleNames) {
    const routesFile = join(modulesDir, name, "routes.ts");
    if (!(await isFile(routesFile))) continue;

    const imported = (await import(pathToFileURL(routesFile).href)) as { default?: unknown };
    if (typeof imported.default !== "function") {
      throw new Error(`Module "${name}": routes.ts phải export default một hàm (router) => void.`);
    }
    (imported.default as RegisterRoutes)(router);
    loaded.push(name);
  }
  return loaded;
}
