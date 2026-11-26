# Run Journal — start/quiq · layer-3-task-02 (Tạo bài thi, phát đề, thu bài, roster)

```yaml
workItem: start/quiq
phaseTask: layer-3-task-02
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-26T20:45:00+07:00
worktree: E:/Quiq/.worktrees/layer-3__task-02
branch: wt/layer-3__task-02
base: 455c348 (staging, qua layer-3-integration)
reviewLevel: STRICT
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-3-task-02-round-2-review.md
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
- 2026-11-26 builder PASS: typecheck/lint/build OK; test 31 file 385/385 (API 16, web 6 mới). Sửa ngoài module: student-session.ts (read cho phiên bị thu hồi bởi chính lần thu bài: lớp closed && revoked_at >= closed_at), shared/student/schemas.ts (WAITING_PRESENCE_FRESH_SECONDS=15). Mới: exams/test-fixtures.ts. Lệch: thêm GET /api/teacher/exams/bank-counts; close lặp → 409; lớp gán chỉ năm học hiện tại. Residual: race Bắt đầu vs Thu bài (start.ts không khóa exam_classes); học sinh đang làm khi thu bài nhận 401 khi lưu đáp án (cần thử tay); retry va chạm mã ở mức DB chưa test. Spawn reviewer STRICT.
- 2026-11-26 reviewer STRICT round 1 = FAIL. MAJOR-1: race Bắt đầu vs Thu bài (start.ts:64-75 không khóa exam_classes) → attempt in_progress trong lớp closed, học sinh kẹt, roster sai. MAJOR-2: close lỗi giữa (1) và (2)/(3) → kẹt vĩnh viễn (close lặp 409, web tắt nút). MINOR: exams/service.ts 425 dòng, hàm >50; retry bắt mọi unique violation → 500; thiếu test nhánh read với phiên bị thu hồi sau khi lớp đóng; xóa đề còn cửa sổ FK → 500. NIT: enterExam cấp phiên active cho lớp closed. Gửi về cùng builder, cho phép sửa có giới hạn attempts/start.ts.
- 2026-11-26 builder fix round 1 PASS: start.ts khóa exam_classes FOR UPDATE (close UPDATE tranh cùng hàng); close idempotent (dispatched|closed → thu hồi phiên revoked_at=closed_at rồi finalize, 200; draft 409); web "Thu bài lại"; tách exams/service.ts → create.ts, delete.ts; retry chỉ exams_code_key; vào lớp closed → phiên chỉ-xem, endpoint active trả 409 EXAM_CLOSED; delete khóa exam_classes. Test 31 file 388/388. Spawn reviewer STRICT round 2.
- 2026-11-26 reviewer STRICT round 2 = PASS. Đóng 2 MAJOR. Mới (không chặn): MINOR-A 3 hàm >50 dòng; MINOR-B enterExam đọc trạng thái lớp ngoài transaction (vô hại nhờ khóa start); MINOR-C thiếu test nhánh unique khác; NIT delete FOR UPDATE nhiều hàng không ORDER BY; NIT submit bằng phiên chỉ-xem khi lớp kẹt ghi endReason submitted. Dispatcher commit trong worktree.
- 2026-11-26 close-out Layer 3 (dispatcher): merge 2 nhánh → layer-3-integration → staging (175586b), không conflict. Verify tổng PASS: typecheck/lint/build, test 33 file 417/417. E2E API thật (Supabase, API riêng cổng 4100 vì pnpm dev của user ở 4000 chưa nạp module mới): 30/30 PASS — CRUD câu hỏi, tạo đề YAH2B8 (5 câu), chưa phát đề → 409, phát đề, HS002 làm + nộp, HS003 làm dở, máy khác vào HS003 → 409, roster 4 trạng thái, thu bài finalized=1, HS003 lưu sau thu → 401, kết quả endReason closed, HS004 phòng chờ thấy closed, thu bài lần 2 idempotent, xóa đề có người thi → 409. Dữ liệu để lại trên staging: bài "[Thử tự động] E2E Layer 3" (YAH2B8) có 2 attempt của HS002/HS003; câu E2E đã xóa. Doc reconcile: API_SPEC (+14 endpoint giáo viên, quy tắc phiên chỉ-xem lớp đã thu bài, khóa), DESIGN (luồng giáo viên, khóa dùng chung), gap G-06 resolved, thêm G-08..G-11. Cleanup worktree.
