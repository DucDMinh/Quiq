const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parseUrl(connectionUrl: string): URL | null {
  try {
    return new URL(connectionUrl);
  } catch {
    return null;
  }
}

/**
 * Suy ra mã project Supabase từ chuỗi kết nối, có hai dạng:
 * - Pooler: user `postgres.<ref>` (host `*.pooler.supabase.com`, cổng 5432 hoặc 6543).
 * - Direct: host `db.<ref>.supabase.co`.
 * Trả null khi không suy ra được (host tự đặt, user pooler không kèm ref, chuỗi rác).
 */
export function supabaseProjectRef(connectionUrl: string): string | null {
  const url = parseUrl(connectionUrl);
  if (!url) return null;
  const user = decodeURIComponent(url.username);
  const poolerRef = /^postgres\.([a-z0-9]+)$/i.exec(user)?.[1];
  if (poolerRef) return poolerRef.toLowerCase();
  const directRef = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(url.hostname)?.[1];
  return directRef ? directRef.toLowerCase() : null;
}

/** So theo máy chủ + cổng + database + user (pooler Supabase dùng chung máy chủ nên không đủ nếu chỉ so máy chủ). */
function pointsToSameServerAndUser(first: string, second: string): boolean {
  if (first.trim() === second.trim()) return true;
  const a = parseUrl(first);
  const b = parseUrl(second);
  if (!a || !b) return false;
  return (
    a.hostname === b.hostname &&
    (a.port || "5432") === (b.port || "5432") &&
    a.pathname === b.pathname &&
    decodeURIComponent(a.username) === decodeURIComponent(b.username)
  );
}

function isLocalHost(connectionUrl: string): boolean {
  const url = parseUrl(connectionUrl);
  return url !== null && LOCAL_HOSTS.has(url.hostname);
}

/**
 * Seed là thao tác ghi dữ liệu mẫu, tuyệt đối không được chạm database production. Từ chối khi:
 * - NODE_ENV=production;
 * - chuỗi kết nối trùng DATABASE_URL_PROD (cùng máy chủ, cổng, database và user);
 * - hoặc cùng PROJECT Supabase với DATABASE_URL_PROD dù đi đường khác (pooler so với direct host);
 * - hoặc không chắc chắn: cả hai chuỗi cùng có mà không suy ra được project ref của một bên
 *   (trừ máy local, chắc chắn không phải production).
 */
export function assertSeedAllowed(env: NodeJS.ProcessEnv, connectionUrl: string): void {
  if (env.NODE_ENV === "production") {
    throw new Error("Từ chối seed: NODE_ENV=production. Dữ liệu mẫu chỉ dành cho môi trường dev/staging.");
  }
  const prodUrl = env.DATABASE_URL_PROD?.trim();
  if (!prodUrl) return;
  if (pointsToSameServerAndUser(prodUrl, connectionUrl)) {
    throw new Error("Từ chối seed: chuỗi kết nối trùng DATABASE_URL_PROD.");
  }
  if (isLocalHost(connectionUrl)) return;

  const prodRef = supabaseProjectRef(prodUrl);
  const currentRef = supabaseProjectRef(connectionUrl);
  if (!prodRef || !currentRef) {
    throw new Error(
      "Từ chối seed: không xác định được project của DATABASE_URL_PROD hoặc của chuỗi kết nối đang dùng, nên không thể chắc chắn chúng khác nhau.",
    );
  }
  if (prodRef === currentRef) {
    throw new Error("Từ chối seed: chuỗi kết nối cùng project Supabase với DATABASE_URL_PROD.");
  }
}
