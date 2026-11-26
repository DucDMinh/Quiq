# Run Journal — start/quiq · layer-4-task-01 (phòng thi SSE + G-12)

```yaml
workItem: start/quiq
phaseTask: layer-4-task-01
step: closeout
agent: dispatcher
status: done
attempt: 1
interrupted: false
updatedAt: 2026-11-26T22:30:00+07:00
worktree: E:/Quiq/.worktrees/layer-4__task-01
branch: wt/layer-4__task-01
reviewLevel: STRICT
filesTouched: []
filesNew: []
evidence:
  reportPath: .context/review-reports/feature-build-quiq-layer-4-task-01-round-2-review.md
  round: 2
  verdict: PASS (round 2)
next: "spec-publisher (feature-update Layer 4, scopeVersion 2) → ⏸ checkpoint Layer 4 (user restart pnpm dev, thử phòng thi trực tiếp)"
loopSignal: none
approvals:
  - { gate: layer_4_scope, at: "2026-11-26", ok: true }   # user: "Duyệt, kèm G-12"
batchQueue: []
```

## Notes
- Layer 1 task, không song song; vẫn chạy trong worktree để reviewer chạy được verify.
- Task được sửa có giới hạn file dùng chung (deps.ts, test-app.ts, server.ts, student/attempts service) vì không có task song song.

## History
- 2026-11-26T19:50 task file commit, worktree setup, spawn builder.
- 2026-11-26 builder PASS. Spike: qua rewrite Next dev tối đa 6ms (trực tiếp 1ms), không nén, không sửa next.config; đã tắt server 3200/4200. Test 37 file 430/430; typecheck/lint/build OK (sửa comment cuối chưa verify lại). File mới ngoài danh sách: roster.ts (tách getRoster), test-setup.ts, roster-expiry.test.ts, testing/sse-client.ts. Lệch: touchPresence đọc trước + chỉ phát khi mới/quay lại; enterExam không phát. Residual quan trọng: stream chỉ kiểm phiên lúc kết nối (đăng xuất/khóa trường vẫn nhận roster tới khi client ngắt); GET roster giờ có ghi (kiểm lười G-12). Builder để lại 2 file log ngoài worktree (.worktrees/l4-typecheck.log, l4-lint.log) — rm của builder bị safety check chặn; dispatcher KHÔNG tự xóa thay, báo user. Spawn reviewer STRICT.
- 2026-11-26 reviewer STRICT round 1 = FAIL. MAJOR M1: stream không kiểm lại phiên sau kết nối (đăng xuất/tắt tài khoản/khóa trường/hết 8 giờ vẫn đẩy roster, vi phạm FR-001). MINOR: m1 test listenerCount có thể chập chờn; m2 EventSource treo CONNECTING → skeleton mãi; m3 không backpressure; m4 thiếu test nhánh lỗi push + tín hiệu từ kiểm hết giờ ở getRoster; m5 không giới hạn kết nối (ghi gap). Gửi về cùng builder: M1 (chỉ kiểm, không gia hạn) + m1-m4.
- 2026-11-26 builder fix round 1 PASS: guards.ts thêm createSessionCheck (chỉ kiểm, không gia hạn: sessionId, chưa thu hồi/hết hạn, staffActive, trường không khóa); stream kiểm trước mỗi lần đẩy + mỗi nhịp, hỏng → đóng luồng; afterEach chờ listenerCount 0; watchdog web 5s/25s; backpressure 1MB → cắt; test nhánh lỗi + tín hiệu G-12 + sse.test.ts. Test 38 file 439/439; verify chạy sau lần sửa cuối. Spawn reviewer STRICT round 2.
- 2026-11-26 reviewer STRICT round 2 = PASS (m6 thiếu test tài khoản tắt + test "không gia hạn" chưa bắt được; m7 comment SCHOOL_LOCKED sai: thực tế hiện Alert, không phải dialog). Commit d840832 trong worktree.
- 2026-11-26 close-out: merge → layer-4-integration → staging (09d1fa1). Verify tổng PASS: 38 file 439/439, typecheck/lint/build. Smoke SSE thật (API riêng cổng 4100, Supabase): header đúng, không nén; ảnh chụp đầu; phát đề / vào phòng chờ / thu bài → sự kiện ~0,8-0,9s sau khi request trả về; không cookie 401; đăng xuất → server đóng luồng sau ~4,5s; bài thử PGYSQY (và 1 bài ở lần đo lại) đã xóa (không attempt). Docs: API_SPEC (stream, roster có ghi, thu bài timeout/closed), DESIGN (realtime), G-12 resolved, thêm G-15..G-17. spec-validator phase review KHÔNG chạy cho layer 1 task này (reviewer STRICT đã đối chiếu FR-035/C-12) — báo user.
