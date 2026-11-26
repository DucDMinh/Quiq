export interface ShutdownTargets {
  server: {
    close(callback: () => void): unknown;
    closeAllConnections(): void;
  };
  closeDb: () => Promise<void>;
  exit: (code: number) => void;
  logError: (error: unknown) => void;
}

/**
 * Tắt êm: đóng server (chờ request đang chạy) rồi mới đóng pool DB, tránh cắt truy vấn giữa chừng.
 * Gọi nhiều lần (SIGINT rồi SIGTERM) chỉ chạy một lần, vì `server.close` lần hai sẽ lỗi ERR_SERVER_NOT_RUNNING.
 */
export function createShutdown({ server, closeDb, exit, logError }: ShutdownTargets): () => void {
  let shuttingDown = false;
  return () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      closeDb()
        .then(() => exit(0))
        .catch((error: unknown) => {
          logError(error);
          exit(1);
        });
    });
    server.closeAllConnections();
  };
}
