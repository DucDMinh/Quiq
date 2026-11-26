# Run Journal — start/quiq · demo-spec-publish (bước 5h, initial build xong demo)

```yaml
workItem: start/quiq
phaseTask: demo-spec-publish
step: spec_publisher
agent: spec-publisher
status: done
attempt: 0
interrupted: false
updatedAt: 2026-11-26T19:30:00+07:00
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/phase-build-quiq-demo-layer-0-3-spec-validation.md
  round: 1
  verdict: PUBLISHED (spec 1.0.0 không bump, scope v1, risk high)
next: "⏸ checkpoint demo: user restart pnpm dev, thử web luồng giáo viên + học sinh; sau đó các layer tính năng 4-17 (chưa có task file, trình bày trong chat để chốt)"
loopSignal: none
approvals:
  - { gate: demo_finish_steps, at: "2026-11-26", ok: true }
batchQueue: []
```

## History
- 2026-11-26T21:20 journal created, spawn spec-publisher (trigger initial-build, demo Layer 0-3).
- 2026-11-26 spec-publisher bị ngắt do giới hạn API (5 giờ), resume sau reset. Kết quả: spec/test-scope/current.json (scope v1, trigger initial-build, risk high, 9 luồng, 26 endpoint, 9 route UI smoke, 14 known issues), spec/updates/2026-11-26-initial-build-demo.md, dòng CHANGELOG (1.0.0 không bump). Đề xuất PATCH 1.0.1 qua /change: mục API Endpoints/Database Schema trong SPECIFICATIONS.md trỏ về docs/API_SPEC.md, docs/ERD.md. File run-android.bat ở gốc không do agent tạo, không commit.
