# Run Journal — start/quiq · layer-2-task-01 (Đăng nhập cán bộ, phiên, guard, khung giao diện giáo viên)

```yaml
workItem: start/quiq
phaseTask: layer-2-task-01
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-26T17:40:00+07:00
worktree: E:/Quiq/.worktrees/layer-2__task-01
branch: wt/layer-2__task-01
base: 98a1590 (staging, qua layer-2-integration)
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-2-task-01-round-2-review.md
  round: 2
  verdict: PASS (round 2)
  commit: f4b6a5a (trong worktree)
next: "⏸ checkpoint Layer 2 (user thử web) → Layer 3 (L3-01, L3-02 song song)"
loopSignal: none
approvals:
  - { gate: layer_2_start, at: "2026-11-26", ok: true }   # user reply ok
batchQueue: []
```

## Notes
- Chạy song song với layer-2-task-02 (worktree riêng). Ownership điểm nối: L2-01 sở hữu apps/api/src/server.ts, config.ts, http/deps.ts, testing/test-app.ts (chỉ thêm, không đổi hợp đồng); L2-02 không đụng các file đó, app.ts, loader.ts, http/errors.ts, packages/shared/src/common, apps/web/src/lib/api-client.ts, next.config.ts, app/page.tsx, app/layout.tsx, packages/db.
- Builder không chạy pnpm dev/start (tranh cổng), không ghi .context/, không commit.

## History
- 2026-11-26T14:40 journal created, worktree setup ok (pnpm install), spawn builder.
- 2026-11-26 builder chạm giới hạn 40 lượt khi đang dở (API gần xong, web dở). Resume cùng builder (SendMessage), không tăng attempt (interrupted ≠ failed).
- 2026-11-26 builder PASS (sau resume): typecheck/lint/build OK, test 23 file 321/321. Sửa thêm (ownership, chỉ thêm): deps.ts (AppDeps.session? tùy chọn), test-app.ts (option session, TEST_SESSION_CONFIG), config.ts (SESSION_SECRET bắt buộc ≥32), server.ts. File mới ngoài danh sách: config.test.ts, testing/staff-fixtures.ts. Lệch: STAFF_SESSION_TTL_MS đặt ở @quiq/shared/auth (db bị khóa); token hash = HMAC-SHA256(SESSION_SECRET). Residual: app.proxy tắt → ctx.ip luôn là IP proxy Next → rate-limit thực chất theo username (người lạ khóa được tài khoản 15 phút). Doc-Impact: API_SPEC (3 endpoint auth + cookie + guard), DESIGN (guard flow, nav-config), .env.local.example (SESSION_SECRET bắt buộc). Spawn reviewer STRICT round 1.
- 2026-11-26 reviewer STRICT round 1 = FAIL. MAJOR-1: race TOCTOU rate-limit (routes.ts:33-40, kiểm count trước await verify, ghi lỗi sau → N request song song vượt giới hạn). MINOR: re-login không thu hồi phiên cũ; dummy hash tạo lười; map in-memory không dọn; login CSRF không kiểm Origin. Residual (không chặn): app.proxy tắt → rate-limit thực chất theo username (cần task cứng hóa sở hữu app.ts, ghi gap). Doc-Impact xác nhận: API_SPEC + DESIGN. Gửi findings về cùng builder (fix: MAJOR-1 + MINOR 1, 2, 3).
- 2026-11-26 builder fix round 1 PASS: rate-limit tryAcquire giữ chỗ đồng bộ trước await (test 10 request song song → 5×401 + 5×429, mutation check bắt được), re-login thu hồi phiên cũ, prepareLoginTiming khi register, sweep theo clock + cap 10k. Test 24 file 328/328; typecheck/lint/build OK. Spawn reviewer STRICT round 2.
- 2026-11-26 reviewer STRICT round 2 = PASS. Đóng MAJOR-1 + 3 MINOR. Finding mới MINOR-5 (lỗi DB khi verify không trả lượt giữ chỗ → khóa oan, fail closed), MINOR-6 (đuổi key theo cap 10k cho phép làm yếu giới hạn). Gap cần ghi: R1 rate-limit theo IP thật sau proxy (app.proxy/app.ts), login CSRF Origin, MINOR-6, bộ đếm theo tiến trình. Dispatcher commit f4b6a5a trong worktree.
- 2026-11-26 close-out Layer 2 (dispatcher): merge 2 nhánh → layer-2-integration → staging (7d4840b), không conflict. Verify tổng PASS: typecheck/lint/build, test 28 file 363/363. Smoke API thật (Supabase): health/db 200; login sai 401 chung; login gv.toan 200 + cookie HttpOnly/Lax; me 200; logout → me 401; enter HS999 404 chung; enter " demo01 "/"hs005" 200 (chuẩn hóa mã); state can_start. KHÔNG bấm Bắt đầu (để HS001 còn lượt cho user). Lưu ý: cổng 4000 có sẵn node PID 21448 không do dispatcher khởi động (nhiều khả năng pnpm dev của user, đã nạp code mới) → smoke chạy trên tiến trình đó. Doc reconcile: docs/API_SPEC.md viết lại as-built, docs/DESIGN.md thêm current-state, tạo docs/changes/TECHNICAL_REQUIREMENT_GAPS.md (G-01..G-07), .env.local.example (SESSION_SECRET bắt buộc), ghi chú Layer 2 vào L3-01/L3-02. progress complete; cleanup worktree.
