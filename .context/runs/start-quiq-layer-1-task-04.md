# Run Journal — start/quiq · layer-1-task-04 (điểm nối API deps db/clock)

```yaml
workItem: start/quiq
phaseTask: layer-1-task-04
step: reviewer
agent: reviewer
status: running                     # cancel sẽ redo: đọc file + git diff trên đĩa trước, KHÔNG revert
attempt: 0
interrupted: false
updatedAt: 2026-11-26T14:00:00+07:00
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-1-task-04-round-1-review.md
  round: 1
  verdict: null
next: "builder PASS → reviewer (NORMAL, chú ý rò rỉ lỗi DB, đóng pool) → commit staging → smoke tay /api/health/db với .env.local thật → ⏸ rồi Layer 2 (2 task song song)"
loopSignal: none
approvals:
  - { gate: layer_1_checkpoint, at: "2026-11-26", ok: true }   # user reply ok
  - { gate: task_04_added, at: "2026-11-26", ok: true }         # user chọn thêm layer-1-task-04
batchQueue: []
```

## Notes
- Lý do: module API chỉ nhận router, không có db/clock; hai task L2 song song sẽ cùng sửa app.ts/loader.ts/server.ts. Task 04 chạy một mình trên nhánh staging (không worktree).
- Seed Supabase: user chưa xác nhận đã seed (chưa trả lời). Không chặn build; cần cho lần thử tay.

## History
- 2026-11-26T14:00 journal created, spawn builder.
- 2026-11-26 builder PASS (tự báo): 264 test, typecheck/lint/build OK. Lệch: sửa apps/api/vitest.config.ts thêm timeout 30s/60s (PGlite + migration 1-2s/lần). Chưa chạy server với DB thật (dispatcher smoke). Builder tạo .context/runs/build-quiq-layer-1-task-04.builder.md => xóa trước commit. Spawn reviewer.
- 2026-11-26 user xác nhận đã seed Supabase (dispatcher đã kiểm: 1 school, 3 staff, 5 students, 30 questions, DEMO01 dispatched). backup/pre-rewrite đã bị xóa (user tự làm), .git 1.1MB.
- 2026-11-26 reviewer round 1 = "FAIL (không kiểm chứng được)": hook agent-guard chỉ cho reviewer cd vào .worktrees/; task chạy trực tiếp ở gốc nên reviewer không chạy được lệnh verify. Đọc code không thấy blocker/major; 3 minor + 2 nit (shutdown chạy hai lần; loader không await register; thông điệp thiếu biến khi biến rỗng; timeout vitest che test chậm; test clock chưa qua route).
  Xử lý: tạo worktree .worktrees/layer-1__task-04 (branch wt/layer-1__task-04), chép 12 file code (so khớp byte), builder làm tiếp ở đó. BÀI HỌC: mọi task dù chạy 1 mình vẫn phải chạy trong worktree để reviewer kiểm chứng được.
  VIỆC CHỜ USER: thư mục gốc E:\Quiq còn thay đổi chưa commit trùng với worktree (apps/api/**). `git checkout --` bị guard chặn với agent nên KHÔNG dọn được. Cần user chạy (PowerShell, mỗi lệnh một dòng) trước khi merge: `git restore apps/api` rồi `git clean -fd apps/api` rồi xóa `.context/runs/build-quiq-layer-1-task-04.builder.md`. Nếu không, merge nhánh wt/layer-1__task-04 sẽ bị từ chối vì ghi đè thay đổi cục bộ.
- 2026-11-26 builder sửa 4 mục (shutdown.ts có cờ + test; loader await register async; thông điệp thiếu biến; test clock qua route; createTestApp({modulesDir})). 269 test xanh. Phát hiện test chập chờn password.test.ts (L1-01): NGUYÊN NHÂN GỐC đã chứng minh = ký tự cuối của salt/khóa base64url có 4 bit thừa, đổi A/B thì byte giải mã y hệt; KHÔNG phải lỗi bảo mật. Sửa test: XOR byte đầu rồi mã hóa lại, 20 lần ổn định, 270 test xanh. Commit riêng phần test này. Spawn reviewer round 2 (trong worktree).
