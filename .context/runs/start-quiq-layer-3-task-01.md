# Run Journal — start/quiq · layer-3-task-01 (Ngân hàng câu hỏi giáo viên)

```yaml
workItem: start/quiq
phaseTask: layer-3-task-01
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-26T20:45:00+07:00
worktree: E:/Quiq/.worktrees/layer-3__task-01
branch: wt/layer-3__task-01
base: 455c348 (staging, qua layer-3-integration)
reviewLevel: NORMAL (STRICT phần cô lập sở hữu)
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-3-task-01-round-2-review.md
  round: 2
  verdict: PASS (round 2)
next: "Layer 3 là layer demo cuối → spec-validator (review phase) → spec-publisher (test-scope initial-build) → ⏸ checkpoint demo (user thử web)"
loopSignal: none
approvals:
  - { gate: layer_2_checkpoint, at: "2026-11-26", ok: true }   # user: "push đi rồi làm tiếp"
batchQueue: []
```

## Notes
- Ownership: L3-01 chỉ modules/questions, shared/questions, web giao-vien/ngan-hang, features/questions. L3-02: modules/exams, class-control, shared/exams, web bai-thi/phong-thi, features/exams, class-control; được sửa có giới hạn modules/student/** + shared/student/** cho hành vi thu bài (không sửa attempts/finalize.ts). Cả hai khóa: http/**, testing/**, app.ts, server.ts, config.ts, loader.ts, shared/common, shared/auth, api-client, next.config, layout, nav-config, packages/db, package.json, lockfile.
- Bài học Layer 2: builder chạm giới hạn 40 lượt → brief yêu cầu tiết kiệm lượt; nếu chạm thì resume cùng builder.

## History
- 2026-11-26T18:00 journal created, worktree setup ok, spawn builder.
- 2026-11-26 builder PASS: 12 file mới đúng ownership; typecheck/lint/build OK; test 30 file 391/391 (API 19, web 9 mới). Quyết định: multiSelect là cờ rõ; sở hữu lọc theo school+teacher (không theo môn); list trả subject; :id sai → 404; hook useReturnFocus. Residual: giáo viên đổi môn → ngân hàng vẫn liệt kê câu môn cũ trong khi L3-02 rút theo môn; zod v4 báo lỗi 2 lượt. Doc-Impact: 5 endpoint /api/teacher/questions. Spawn reviewer NORMAL (STRICT phần cô lập sở hữu).
- 2026-11-26 reviewer round 1 = FAIL. Logic API + cô lập chủ/trường OK. MAJOR-1: question-editor-dialog.tsx 365 dòng, question-list.tsx 364 dòng > ui.max_file_lines 300. MINOR: page không giới hạn trên; 3 component > 50 dòng; lỗi options.<i> không xóa khi bỏ đáp án. NIT: hằng số độ dài, aria-label trùng, thiếu test super_admin. Đổi môn giáo viên: không áp dụng (BR-017 môn cố định). Gửi về cùng builder: MAJOR-1 + MINOR 1-3 + NIT aria/super_admin.
- 2026-11-26 builder fix round 1 PASS: tách web thành 10 file (lớn nhất 128 dòng), page max 10000, hàm ≤50 dòng, shiftErrorsAfterRemoval + test, limits.ts hằng số, aria-label theo nội dung, test super_admin 403. Test 30 file 392/392. File test >300 dòng (325, 314) chưa tách. Spawn reviewer round 2.
- 2026-11-26 reviewer round 2 = PASS (2 NIT: 2 component 52 dòng; file test > 300 dòng chấp nhận). Dispatcher commit trong worktree. Residual: school_admin xem câu hỏi cần task riêng.
- 2026-11-26 close-out Layer 3 (dispatcher): merge 2 nhánh → layer-3-integration → staging (175586b), không conflict. Verify tổng PASS: typecheck/lint/build, test 33 file 417/417. E2E API thật (Supabase, API riêng cổng 4100 vì pnpm dev của user ở 4000 chưa nạp module mới): 30/30 PASS — CRUD câu hỏi, tạo đề YAH2B8 (5 câu), chưa phát đề → 409, phát đề, HS002 làm + nộp, HS003 làm dở, máy khác vào HS003 → 409, roster 4 trạng thái, thu bài finalized=1, HS003 lưu sau thu → 401, kết quả endReason closed, HS004 phòng chờ thấy closed, thu bài lần 2 idempotent, xóa đề có người thi → 409. Dữ liệu để lại trên staging: bài "[Thử tự động] E2E Layer 3" (YAH2B8) có 2 attempt của HS002/HS003; câu E2E đã xóa. Doc reconcile: API_SPEC (+14 endpoint giáo viên, quy tắc phiên chỉ-xem lớp đã thu bài, khóa), DESIGN (luồng giáo viên, khóa dùng chung), gap G-06 resolved, thêm G-08..G-11. Cleanup worktree.
