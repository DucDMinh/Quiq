# Run Journal — start/quiq · layer-2-task-02 (Luồng học sinh thi trọn vẹn (API + web))

```yaml
workItem: start/quiq
phaseTask: layer-2-task-02
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-26T17:40:00+07:00
worktree: E:/Quiq/.worktrees/layer-2__task-02
branch: wt/layer-2__task-02
base: 98a1590 (staging, qua layer-2-integration)
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-2-task-02-round-2-review.md
  round: 2
  verdict: PASS (round 2)
  commit: 681eaec (trong worktree)
next: "⏸ checkpoint Layer 2 (user thử web) → Layer 3 (L3-01, L3-02 song song)"
loopSignal: none
approvals:
  - { gate: layer_2_start, at: "2026-11-26", ok: true }   # user reply ok
batchQueue: []
```

## Notes
- Chạy song song với layer-2-task-01 (worktree riêng). Ownership điểm nối: L2-01 sở hữu apps/api/src/server.ts, config.ts, http/deps.ts, testing/test-app.ts (chỉ thêm, không đổi hợp đồng); L2-02 không đụng các file đó, app.ts, loader.ts, http/errors.ts, packages/shared/src/common, apps/web/src/lib/api-client.ts, next.config.ts, app/page.tsx, app/layout.tsx, packages/db.
- Builder không chạy pnpm dev/start (tranh cổng), không ghi .context/, không commit.

## History
- 2026-11-26T14:40 journal created, worktree setup ok (pnpm install), spawn builder.
- 2026-11-26 builder chạm giới hạn 40 lượt khi đang dở (API đã có module student/attempts + shared/student, web chưa bắt đầu). Resume cùng builder (SendMessage), không tăng attempt.
- 2026-11-26 builder PASS (sau resume): typecheck/lint/build OK, test 23 file 301/301. File ngoài danh sách: student/errors.ts, student/test-fixtures.ts, attempts/start.ts, selection.ts, shared/student/schemas.test.ts, web student-api.ts, portal-frame.tsx, use-exam-attempt.ts. Lệch: thêm GET /api/student/attempts/:id (tải lại trang); phiên chỉ-xem sau khi kết thúc (401 thay 409 ở 2 nhánh); đổi máy tạm: vào thi không cookie khi đang in_progress → thu hồi phiên cũ, máy mới làm tiếp attempt (cần reviewer đánh giá rủi ro chiếm bài). Residual: cookie Secure theo ctx.secure (lệch với L2-01 dùng NODE_ENV; sau proxy sẽ thiếu Secure); phiên phòng chờ chưa có TTL; race 23505 chỉ thật trên Postgres. Doc-Impact: API_SPEC (7 endpoint student/attempts + mã lỗi), DESIGN (phiên chỉ-xem, finalizeAttempt). Spawn reviewer STRICT round 1.
- 2026-11-26 reviewer STRICT round 1 = FAIL. CRITICAL C1: /student/enter không cookie luôn cấp phiên hiệu lực mới + thu hồi phiên cũ → bạn cùng lớp biết mã bài + HS001 chiếm bài đang làm, đọc/ghi đè đáp án, nộp thay (trái C-03/C-13); cấp phiên ở lớp Y thu hồi phiên lớp X. MAJOR M1: Doc-Impact API_SPEC/DESIGN → dispatcher làm ở close-out Layer 2 (builder bị cấm sửa docs/), trailer không ghi none. MINOR: m1 ATTEMPT_ALREADY_COMPLETED chết code; m2 Secure theo ctx.secure (thống nhất khi merge với L2-01); m3 không TTL → L3-02 thu hồi theo exam_class khi thu bài. NIT tone danger → info. Gửi về cùng builder: sửa C1 + NIT.
- 2026-11-26 builder fix round 1 PASS: bỏ "đổi máy tạm"; /student/enter không cookie hiệu lực + đang in_progress ở bất kỳ đâu → 409 ATTEMPT_IN_PROGRESS, không thu hồi/cấp phiên (kiểm trong cùng transaction); cookie hiệu lực đúng học sinh+lớp → giữ phiên; phiên chỉ-xem không thu hồi phiên khác. 4 test mới (a, a', b, c). NIT tone info. Test 23 file 305/305; typecheck/lint/build OK. Residual: race Bắt đầu vs enter trên Postgres READ COMMITTED (cửa sổ hẹp); mất cookie giữa giờ bị khóa tới hết giờ; /student/enter chưa rate-limit. Spawn reviewer STRICT round 2.
- 2026-11-26 close-out Layer 2 (dispatcher): merge 2 nhánh → layer-2-integration → staging (7d4840b), không conflict. Verify tổng PASS: typecheck/lint/build, test 28 file 363/363. Smoke API thật (Supabase): health/db 200; login sai 401 chung; login gv.toan 200 + cookie HttpOnly/Lax; me 200; logout → me 401; enter HS999 404 chung; enter " demo01 "/"hs005" 200 (chuẩn hóa mã); state can_start. KHÔNG bấm Bắt đầu (để HS001 còn lượt cho user). Lưu ý: cổng 4000 có sẵn node PID 21448 không do dispatcher khởi động (nhiều khả năng pnpm dev của user, đã nạp code mới) → smoke chạy trên tiến trình đó. Doc reconcile: docs/API_SPEC.md viết lại as-built, docs/DESIGN.md thêm current-state, tạo docs/changes/TECHNICAL_REQUIREMENT_GAPS.md (G-01..G-07), .env.local.example (SESSION_SECRET bắt buộc), ghi chú Layer 2 vào L3-01/L3-02. progress complete; cleanup worktree.
