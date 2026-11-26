# Run Journal — start/quiq · demo-phase-validate (hết Layer 3, layer demo cuối)

```yaml
workItem: start/quiq
phaseTask: demo-phase-validate
step: spec_validator
agent: spec-validator
status: awaiting
attempt: 0
interrupted: false
updatedAt: 2026-11-26T21:15:00+07:00
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/phase-build-quiq-demo-layer-0-3-spec-validation.md
  round: 1
  verdict: PASS
next: "spec-publisher (initial-build, test-scope từ §6 report) → ⏸ checkpoint demo"
loopSignal: none
approvals:
  - { gate: demo_finish_steps, at: "2026-11-26", ok: true }   # user chọn "Làm tiếp 2 bước"
batchQueue: []
```

## Notes
- Bước 5g (review phase) đã bị bỏ qua ở cuối Layer 1 và Layer 2; lần này validate gộp Layer 0-3 (toàn bộ demo).

## History
- 2026-11-26T20:55 journal created, spawn spec-validator.
- 2026-11-26 spec-validator chạm giới hạn 20 lượt, resume để ghi report. Verdict PASS: 22 Covered, 6 Partial (đều có layer đích), 0 Missing; conflicts 0 HIGH, 1 MEDIUM (M-1 roster không kiểm hết giờ + thu bài gán closed cho bài quá hạn → G-12), 4 LOW. Lệch docs: API_SPEC thiếu EXAM_CLOSED ở start; ERD header + source_question_id + cột publish. Dispatcher đã sửa docs, thêm G-12..G-14, ghi rõ hậu quả G-04. Bài E2E YAH2B8 giữ lại trên staging (ghi chú bàn giao test).
