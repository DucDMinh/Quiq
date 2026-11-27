# Run Journal — start/quiq · layer-5-task-02 (tra cứu điểm công khai)

```yaml
workItem: start/quiq
phaseTask: layer-5-task-02
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-27T10:00:00+07:00
worktree: E:/Quiq/.worktrees/layer-5__task-02
branch: wt/layer-5__task-02
reviewLevel: STRICT
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-5-task-02-round-2-review.md
  round: 2
  verdict: PASS (round 2)
next: "spec-publisher (feature-update Layer 5, scopeVersion 3) → cleanup worktree cũ (user đồng ý) → ⏸ checkpoint Layer 5"
loopSignal: none
approvals:
  - { gate: layer_4_checkpoint, at: "2026-11-27", ok: true }   # user: "Đã thử OK, sang Layer 5" (không chạy spec-validator bổ sung)
  - { gate: layer_5_scope, at: "2026-11-27", ok: true }        # chỉ sau thu bài; một chiều; không làm bài = 0 điểm
  - { gate: cleanup_old_worktrees_after_layer_5, at: "2026-11-27", ok: true }   # user: dọn worktree cũ layer 1-4 + nhánh integration sau Layer 5
  - { gate: fix_g01_in_task_02, at: "2026-11-27", ok: true }   # user: sửa G-01 (app.proxy, XFF 1 hop) ngay trong task 02
  - { gate: g01_accept_risk_until_deploy, at: "2026-11-27", ok: true }   # user: Next không chuyển IP → chấp nhận rủi ro, G-01 thêm /api/lookup, chặn deploy prod tới khi có reverse proxy ghi IP
batchQueue: []
```

## Notes
- Layer 5 chạy song song 2 task (wave 1), không trùng file (đã kiểm bằng `parallel-dispatch plan`).

## History
- 2026-11-27 resume: Layer 4 checkpoint user duyệt. Task file ghi + commit, setup worktree, spawn builder.
- 2026-11-27 builder PASS (resume 1 lần do hết 40 lượt, không tăng attempt). Test 40 file 465/465 (2 timeout chập chờn ở test-app.test.ts, chạy lại pass), typecheck/lint/build xanh. Lệch: 422 VALIDATION thay 400 (quy ước chung); không limit theo schoolId; không errors.ts riêng; docs để close-out. Residual chính: rate-limit theo IP thực chất toàn cục vì app.proxy tắt (sau rewrite Next mọi request cùng IP; 30 lượt/phút chung) — cần user quyết. Spawn reviewer STRICT round 1.
- 2026-11-27 reviewer STRICT round 1 = FAIL. MAJOR M1: rate-limit theo ctx.ip thực chất toàn cục (app.proxy tắt, G-01) → DoS tra cứu. MINOR: m1 AC 400 vs 422 (sửa câu AC), m2 nuốt lỗi tải năm học, m3 bảng cũ không reset khi đổi input, m4 SchoolPicker >50 dòng, m5 lookup.test.ts >300 dòng, m6 heading text-3xl không clamp (Responsive gate), m7 không limit schoolId (chấp nhận); thiếu bằng chứng touch target 44px. Phần bảo mật cốt lõi đạt.
- 2026-11-27 user chốt sửa G-01 trong task 02 (app.ts nằm ngoài file của task 01, không xung đột). Gửi builder fix round 1.
- 2026-11-27 builder fix round 1: m2-m6 + touch 44px xong, 41 file 468/468, typecheck/lint/build xanh. M1 BLOCKED có bằng chứng: rewrite Next 16.4.6 (proxy-request.js, httpxy không bật xfwd) không thêm XFF; thử thật: upstream nhận XFF client tự gửi nguyên văn, không có XFF khi client không gửi → bật app.proxy sẽ cho né rate-limit. Không sửa app.ts. Chờ user quyết.
- 2026-11-27 user chọn chấp nhận M1 (G-01 mở rộng /api/lookup, chặn deploy production tới khi có reverse proxy thật). Spawn reviewer round 2 (cùng reviewer).
- 2026-11-27 close-out: merge layer-5-integration → staging (a4d49bc). Verify tổng PASS: 44 file 489/489, typecheck/lint/build. Docs: API_SPEC (publish-answers/scores, /answers, lookup x3, mã lỗi), DESIGN (current-state Layer 5), GAPS (G-01 mở rộng + chặn deploy, G-10 note, G-18..G-20). spec-validator phase review không chạy riêng (reviewer STRICT đối chiếu FR).
