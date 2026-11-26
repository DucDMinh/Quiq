# Run Journal — start/quiq · layer-1 (3 task song song, 1 wave)

```yaml
workItem: start/quiq
phaseTask: layer-1
step: closeout
agent: null
status: awaiting                    # ⏸ checkpoint Layer 1: chờ user thử + duyệt (cần user tự seed Supabase)
attempt: 0
interrupted: false
updatedAt: 2026-11-26T11:00:00+07:00
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-1-task-NN-round-R-review.md
  round: 0
  verdict: PASS
next: "3 builder PASS → 3 reviewer (STRICT cho L1-01 DB; NORMAL L1-02, L1-03) → commit trong worktree → merge --layer 1 → verify tổng thể → progress → ⏸ checkpoint Layer 1"
loopSignal: none
approvals:
  - { gate: layer_0_checkpoint, at: "2026-11-26", ok: true }
batchQueue: [layer-1/task-01, layer-1/task-02, layer-1/task-03]
```

## Notes
- DATABASE_URL_STAGING đã điền (pooler Supabase). Chỉ worktree L1-01 được copy .env.local; builder dặn không đọc/in nội dung.
- worktree_setup_cmd = pnpm install --frozen-lockfile (đã commit d61babb).
- Dispatcher plan: 1 wave, 3 task, không trùng file.

## History
- 2026-11-26T11:00 journal created; setup worktrees.
- 2026-11-26 L1-02: builder PASS (tự báo: 91 test xanh, typecheck/lint/build OK, chưa đo coverage vì chưa có @vitest/coverage-v8). Spawn reviewer-2 (STRICT phần chấm điểm). Builder để lại .context/runs/build-quiq-layer-1-task-02.builder.md trong worktree: KHÔNG commit, xóa trước khi commit.
- 2026-11-26 L1-02: reviewer PASS (STRICT chấm điểm; 4 minor m1-m4, 2 nit). Report ở root .context/review-reports (guard chỉ cho ghi ở root). Cho builder sửa m1-m4 rồi dispatcher tự chạy lại verify.
- 2026-11-26 L1-01: builder PASS (migrate lên Supabase staging OK: 19 bảng, RLS bật, 0 grant anon/authenticated). db:seed:demo BLOCKED bởi agent-guard (pattern db:seed), đúng quy định AGENTS (cấm seed staging/prod): CẦN USER tự chạy `pnpm --filter @quiq/db db:seed:demo` ở checkpoint. Spawn reviewer-1 STRICT.
- 2026-11-26 L1-03: builder PASS. Vấn đề: MinWidthGuard ở root layout unmount children khi hẹp (mất timer/đáp án), không miễn /tra-cuu. Gửi builder sửa trước khi review.
- Người dùng chọn: viết lại lịch sử git để bỏ 95MB (origin/staging ĐÃ có assets do push từ phía user), user tự force-push. Làm SAU khi Layer 1 merge+cleanup (tránh kéo lại 95MB qua nhánh wt/*). Việc xóa tools/vibe-studio/public/assets đang là thay đổi chưa commit trong cây gốc; sẽ được hấp thụ khi viết lại lịch sử.
- 2026-11-26 L1-01: reviewer STRICT PASS (9 minor, 6 nit; không chạm DB thật nên lời khai migrate staging CHƯA xác nhận độc lập). Builder sửa m1 (verifyPassword không ném), m2 (guard prod so project ref), m4 (test FK chéo trường), m8 (tách file/hàm), m9 (cảnh báo doc), N2, N5, N4.
  GHI NHẬN CHO LAYER SAU (không sửa ở L1, migration 0000/0001 đã áp lên staging, chỉ thêm migration mới ở layer sau):
  - m3: student_sessions không hết hạn + chỉ mục một phiên còn hiệu lực mỗi học sinh toàn hệ thống => L2-02 PHẢI thu hồi phiên khi nộp/thu bài hoặc đặt TTL, nếu không bài thi sau bị coi là đổi máy.
  - m5: attempt_answers không ép câu thuộc cùng exam với attempt => API validate (L2-02), cân nhắc migration 0002 ADD CONSTRAINT ở layer sau (bảng rỗng nên an toàn nhưng gắn cờ).
  - m6: mã học sinh/mã bài thi phân biệt hoa thường => API chuẩn hóa (L2-02, L3-02).
  - m7: thiếu index enrollments(class_id), assignments(class_id), exam_classes(class_id) => migration mới khi cần hiệu năng.
  - N1: ssl "require" chưa xác minh chứng chỉ => xem lại khi deploy.
  - N6: sessions không lưu role/school (suy ra qua join), chấp nhận.
- 2026-11-26 L1-03: reviewer round 1 = FAIL (1 blocker F1: Timer thiếu mốc 30 giây; spec tự mâu thuẫn §3 hai mốc vs §11 ba mốc, theo bản chặt hơn). F2 (dialog portal ngoài wrapper hidden) quyết sửa ngay bằng PortalContainerContext. F3..F6 + nit sửa luôn vì file bị khóa với layer sau. Builder sửa → round 2 (tối đa 2 vòng; còn FAIL thì hỏi user).
  VIỆC TREO: design-spec §3 (dòng ~68) nói 2 mốc thông báo, §11 nói 3 mốc: cần sửa spec cho nhất quán (chưa sửa, chờ user duyệt vì user muốn duyệt doc trước).
- 2026-11-26 L1-01 COMMITTED 6fba8b3 (wt/layer-1__task-01); L1-02 COMMITTED 1a3815c (wt/layer-1__task-02). L1-03: builder sửa xong F1..F6 (Timer 3 mốc, PortalContainerContext, test mutation, token thay px, use client, extendTailwindMerge, buildUrl, AbortError) → reviewer round 2 (vòng cuối).
- 2026-11-26 L1-03 COMMITTED 2a3a38a (round 2 PASS). merge --layer 1: 3 nhánh không xung đột. Verify tổng thể trên layer-1-integration: install/typecheck/lint OK, 252 test xanh (16 file), build OK. progress: complete x3, set-layer current 1 total 4 (sẽ lên 2 khi user duyệt). Việc treo: seed demo vào Supabase (user tự chạy, AGENTS cấm agent seed staging); design-spec §3/§11 mâu thuẫn mốc thông báo đồng hồ; viết lại lịch sử git để bỏ 95MB assets (user tự force-push).
