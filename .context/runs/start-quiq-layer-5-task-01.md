# Run Journal — start/quiq · layer-5-task-01 (công bố đáp án/bảng điểm + Xem đáp án)

```yaml
workItem: start/quiq
phaseTask: layer-5-task-01
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-27T10:00:00+07:00
worktree: E:/Quiq/.worktrees/layer-5__task-01
branch: wt/layer-5__task-01
reviewLevel: STRICT
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-5-task-01-round-2-review.md
  round: 2
  verdict: PASS (round 2)
next: "spec-publisher (feature-update Layer 5, scopeVersion 3) → cleanup worktree cũ (user đồng ý) → ⏸ checkpoint Layer 5"
loopSignal: none
approvals:
  - { gate: layer_4_checkpoint, at: "2026-11-27", ok: true }   # user: "Đã thử OK, sang Layer 5" (không chạy spec-validator bổ sung)
  - { gate: layer_5_scope, at: "2026-11-27", ok: true }        # chỉ sau thu bài; một chiều; không làm bài = 0 điểm
  - { gate: cleanup_old_worktrees_after_layer_5, at: "2026-11-27", ok: true }   # user: dọn worktree cũ layer 1-4 + nhánh integration sau Layer 5
  - { gate: answers_publish_all_classes_closed, at: "2026-11-27", ok: true }   # user: Công bố đáp án chỉ khi MỌI lớp của bài đã thu bài (lớp chưa phát đề cũng chặn); bảng điểm giữ theo lớp
batchQueue: []
```

## Notes
- Layer 5 chạy song song 2 task (wave 1), không trùng file (đã kiểm bằng `parallel-dispatch plan`).

## History
- 2026-11-27 resume: Layer 4 checkpoint user duyệt. Task file ghi + commit, setup worktree, spawn builder.
- 2026-11-27 builder PASS (resume 1 lần do hết 40 lượt, không tăng attempt). Test 41 file 454/454, typecheck/lint/build exit 0. Lệch: thêm publish-actions.tsx (control-panel gần trần 300 dòng), sửa use-roster.ts + fixture exams.test.tsx/class-control.test.tsx; ANSWERS_NOT_PUBLISHED = 409; chặn thêm lớp closed còn attempt in_progress. ESCALATE: công bố theo lớp nhưng đề theo bài → lớp A công bố đáp án khi lớp B cùng đề còn thi = rò đáp án; cần user quyết. Spawn reviewer STRICT round 1.
- 2026-11-27 user chốt: công bố đáp án chờ mọi lớp của bài thu bài (lớp chưa phát đề cũng chặn); bảng điểm giữ theo lớp. Gộp vào vòng fix sau reviewer round 1.
- 2026-11-27 reviewer STRICT round 1: phần builder PASS theo task, nhưng R1 MAJOR rò đáp án chéo lớp cùng bài (user đã chốt: đáp án chờ mọi lớp thu bài) → coi như FAIL, gửi builder fix: chặn publish-answers khi còn lớp cùng bài chưa closed + kiểm phòng thủ trong getAttemptAnswers + test; M1 test /paper + stream sau công bố; M2 test công bố đồng thời. Builder chạy model cũ (sonnet) vì config mới chưa nạp.
- 2026-11-27 builder fix round 1 PASS: lỗi mới OTHER_CLASSES_NOT_CLOSED (409); publishAnswersWhenExamFinished khóa mọi exam_classes của bài FOR UPDATE ORDER BY id rồi kiểm hasUnfinishedClass; kiểm phòng thủ trong getAttemptAnswers; ExamClassState.otherClassesOpen; test 2 lớp/draft/closed còn attempt/đồng thời/paper/SSE. Test 41 file 460/460, typecheck/lint/build exit 0. Spawn reviewer STRICT round 2 (cùng reviewer, giữ context).
- 2026-11-27 reviewer STRICT round 2 = PASS (m1 deadlock lý thuyết với xóa đề G-10 → ghi G-10; m2 otherClassesOpen tính cả khi không cần; m3 cờ trễ ~10s phía A; n1, n2). Commit 34c3923 trong worktree.
- 2026-11-27 close-out: merge layer-5-integration → staging (a4d49bc). Verify tổng PASS: 44 file 489/489, typecheck/lint/build. Docs: API_SPEC (publish-answers/scores, /answers, lookup x3, mã lỗi), DESIGN (current-state Layer 5), GAPS (G-01 mở rộng + chặn deploy, G-10 note, G-18..G-20). spec-validator phase review không chạy riêng (reviewer STRICT đối chiếu FR).
