# Spec Notes

## Purpose
Ghi chú khi dựng/validate spec (`/spec-init`) và khi change request cập nhật spec.

## Format

```markdown
### {Ngày} — {change request / spec-init}

**Nguồn:** code scan | spec/changes/<file>
**Ghi chú:** {điểm cần lưu}
```

## Log

### 2026-11-25 — /start (greenfield)

**Nguồn:** docs/BRD.md (v1.0, đã duyệt 2026-11-25)
**Ghi chú:** Repo chưa có code → không chạy /spec-init (reverse-engineer); SPECIFICATIONS.md dựng từ BRD ở session chính, ID FR/BR giữ nguyên. docs/{DESIGN,API_SPEC,ERD,PERMISSION}.md còn là template (non-canonical, xem .context/doc-index.json). Phát hiện: Cloud Storage for Firebase cần gói Blaze → xung đột "chỉ hạ tầng miễn phí" (chờ chủ dự án quyết ở brainstorm).
