Agent: reviewer

# Review: build-quiq layer-1 task-02 (Exam engine, pure functions), round 1

> Note: agent-guard blocked writing this report into the worktree path `E:\Quiq\.worktrees\layer-1__task-02\.context\review-reports\...`. It is written to the project-root path that the guard allows. The primary should copy it into the worktree if needed.

- Worktree: `E:\Quiq\.worktrees\layer-1__task-02` (branch `wt/layer-1__task-02`), uncommitted changes
- Review level: **STRICT** for grading (`grade.ts`) and `canStartAttempt`. **NORMAL** for shuffle, draw and clock.
- Reason: grading logic and the start-attempt gate are core business rules. A mistake there gives students wrong scores or wrong attempt counts. The rest is pure, isolated logic covered by tests.
- Blast radius: `packages/engine` only. The future api layer (grading, regrade job, start attempt, sweeper, submit) and web (shuffle mapping) will consume it. No DB, API contract or UI changed yet.

## Verify commands + result (run by the reviewer in the worktree)

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS (db, shared, engine, web, api: Done) |
| `pnpm lint` | PASS (`eslint apps packages`, no output) |
| `pnpm test` | PASS: 8 test files, **91 tests passed** |
| `pnpm build` | PASS (web `next build` OK) |
| Coverage | Not measured: `@vitest/coverage-v8` is not installed. Estimated by reading below. |

## Scope check
- `git status --short`: modified `packages/engine/src/index.ts`, plus new files `types.ts`, `grade.ts`, `shuffle.ts`, `draw.ts`, `attempt-state.ts` and 4 `*.test.ts`. The only file outside the engine is `.context/runs/build-quiq-layer-1-task-02.builder.md`, the builder journal the dispatcher deletes. OK.
- No `package.json` or lockfile changed, so no new dependency.
- Grep over `packages/engine`:
  - no `Date.now`, `new Date()` without arguments, `Math.random`, `node:` import or `require(`
  - the only external import is `vitest`, in the test files
  - no secrets or keys

## Acceptance Criteria

| AC | Result | Evidence |
|---|---|---|
| Grading: single and multi answer (full, missing, extra, empty, foreign id); 7/9 = 7.78; 0 questions throws a clear error | OK | `grade.ts:7-17`, `grade.test.ts:10-115`; `roundScore(0,0)` throws `EngineError("empty_exam")` |
| Shuffle: valid permutation, same rng gives same result, different rng gives a different order, mapping back to original answers gives the same score | OK | `shuffle.ts:31-100`, `shuffle.test.ts:34-139` |
| Draw: correct total and per-level counts, no duplicates, short on Hard gives `{difficulty:'hard',have:8,need:10}`, real random selection | OK | `draw.ts:10-41`, `draw.test.ts:29-135` (seeded rng plus a light statistical test that all 6 questions get picked) |
| `canStartAttempt`: all 5 reasons, any `maxAttempts` | OK (see m2) | `attempt-state.ts:36-43`, tests `:69-110` |
| Clock: `isExpired` boundaries at ends_at and ends_at+3s; time is always a parameter | OK | `attempt-state.ts:24-29`, tests at(0), at(3000) give false and at(3001) gives true |
| No runtime dependency, full TS types, coverage ≥90% | OK / **unverified by tool** | No runtime imports. Types are exported via `export * from "./types"`. Coverage is estimated by reading. |

## Grading (STRICT): hand proof of `floor((2000c + t)/(2t))/100`
(2000c+t)/(2t) = 1000c/t + 1/2, so floor(x + 1/2) is half-up rounding of 1000c/t, which is score×100. Everything is integer arithmetic far below 2^53. When the true quotient is an integer, the IEEE division is exact, so floor cannot round the wrong way.
- 7/9: 14009/18 = 778.27, giving **7.78**
- 1/3: 2003/6 = 333.83, giving **3.33**
- 1/16: 2016/32 = 63 exactly (true value 62.5, half-up), giving **0.63**
- 201/2000: 404000/4000 = 101 (true value 100.5; `Math.round(1.005*100)` would give the wrong 100), giving **1.01**
- 5/10: 10010/20 = 500.5, giving **5**
- 3/16: 6016/32 = 188 (187.5 rounds up), giving 1.88
- Ends: c=0 gives 0.5, so **0**. c=t gives 1000.5, so **10**.

All values are correct half-up. `hundredths/100` returns the nearest double, so `toBe(7.78)` holds.

`isQuestionCorrect`:
- Duplicate selected id `["a","a"]` against `["a"]` gives true. The Set collapses duplicates, which is reasonable.
- A foreign id gives false.
- An empty selection gives false.
- A question with no correct answer is always false, even when left empty. That is defensible, but the api must require at least 1 correct answer when saving a question.
- `__proto__` as an option id is fine inside a Set.

`AnswerSheet`:
- A missing key, or a key not owned by the object (via `Object.hasOwn`), counts as empty, which is wrong.
- An own `__proto__` key from `JSON.parse` is read correctly.

`scoreAttempt([])` throws `empty_exam`. `officialScore([])` returning `null` is acceptable, since no attempt has been graded yet. The api must handle `null` (show "no score yet") and must not coerce it to 0.

## `canStartAttempt` (STRICT): order of reasons
The order is `not_dispatched > closed > already_completed > in_progress_elsewhere > max_attempts`.
- Design doc line 83 lists the conditions in the order "dispatched and not closed, no completed attempt, count < max_attempts (including interrupted), no in_progress". That is a list of conditions, not a messaging priority.
- Putting max_attempts last is reasonable. `usedAttempts` already counts the in_progress or completed attempt, so the more specific reason is more useful. Example: a student on their last attempt that is still in progress is told "in progress elsewhere", not "out of attempts".
- Class closed while the student is also out of attempts or completed returns `closed`. That is the more fundamental reason and not misleading: the closed class blocks starting either way (line 90).
- Design line 88: same cookie plus an in_progress attempt means resume. The api must handle resume BEFORE calling `canStartAttempt`, otherwise a resume would be denied as `in_progress_elsewhere`. Recorded as residual risk.

## Clock
- `isExpired` uses `now > endsAt + grace*1000`, strictly greater. The 3s default matches design line 113.
- `remainingSeconds` is `max(0, ceil(...))`.
- `computeEndsAt` validates minutes.
- The design sweeper (line 86) uses `now > ends_at` with no grace. The api should call `isExpired(endsAt, now, 0)` for the sweeper, or document that it uses grace. Informational.

## Shuffle and draw
- `cryptoRng`:
  - It computes `acceptLimit = 2^32 - (2^32 % n)` and accepts `value < acceptLimit`. The accepted range is a multiple of n, so there is no modulo bias. With n = 2^32 the limit is 2^32 and every value is accepted.
  - It uses `globalThis.crypto.getRandomValues`, with no `node:crypto` and no `Math.random`, so it works on the web.
  - It requires Node 19+, or 18 with the global crypto. Residual: I did not check the `engines` field.
- `shuffled` is Fisher-Yates on a copy. `pickIndex` validates the rng output.
- `drawQuestions`:
  - It validates negative or non-integer values, total = 0 and a wrong sum.
  - It checks for missing questions BEFORE drawing anything.
  - Errors are structured `{code, difficulty, have, need}`, not bare strings.
  - It reports only the first short level, in easy, medium, hard order. That is acceptable.

## Test quality: mutation analysis (by reading)

| Mutation | Caught? |
|---|---|
| `isExpired` `>` changed to `>=` | Yes (`at(3000)` expects false) |
| Set equality changed to "contains" (either direction) | Yes (missing and extra tests) |
| half-up changed to half-even | Yes (1/16 gives 0.62 and 201/2000 gives 1.00, both fail) |
| `ceil` changed to `floor` in `remainingSeconds` | Yes (0.5s test) |
| `>=` changed to `>` in max_attempts | Yes (used=max=5) |
| `Object.hasOwn` removed | Yes, indirectly (`new Set(Object.prototype)` throws TypeError) |
| Fisher-Yates `pickIndex(rng, i+1)` changed to `pickIndex(rng, i)` (Sattolo, never produces the identity permutation) | **No** (see m1) |
| Rejection sampling removed from `cryptoRng` | No. It is not statistically detectable; verified by reading. |

Coverage estimate: every main branch is tested. These defensive branches are untested:
- `orderedBy` length mismatch
- `presentAttempt` missing optionOrder
- non-integer `position`
- `?? []` on an own key whose value is undefined
- NaN grace
- Infinity minutes
- the `cryptoRng` rejection loop

My estimate is ≥90% of lines for the important functions, but no tool confirmed it.

## Skill gates
- aislop: **skip**, `aislop` not installed (exit 127).
- oxlint (anti-slop): **skip**, oxlint not configured; the repo uses eslint and `pnpm lint` PASS.
- ocr (open-code-review): **OK**. `ocr review --format json` gave 3 findings, all severity `low` (performance and maintainability), with no CRITICAL or MAJOR:
  - `drawQuestions` filters the bank multiple times
  - `cryptoRng` allocates a new `Uint32Array` on every call
  - `Math.max(...scores)` could overflow the stack on a huge array, which is unrealistic here
- AI-readable: **OK**.
  - All functions are ≤50 lines and all files are ≤300 lines.
  - Names are clear and comments explain WHY (the half-up and hasOwn reasoning).
  - Constants are named.
  - 1 minor indicator: the wrong comment in a test (n2).
- ai-friendly-web: **N/A**, internal package, not public.
- blitzstrike: **N/A**, no auth, public API or input surface.
- Responsive Checklist Gate: **N/A**, the diff has no UI.

## Findings
No CRITICAL or MAJOR findings.

- **[MINOR] m1:** `packages/engine/src/shuffle.test.ts:34-50`. No test catches the Fisher-Yates off-by-one `pickIndex(rng, i)`: with `() => 0` both versions give `[2,3,1]`, and the "firsts.size > 3" test still passes. Fix: for n=3, drive the rng with an enumeration of every choice sequence (3×2) and assert that all 6 permutations appear, including the identity.
- **[MINOR] m2:** `packages/engine/src/attempt-state.ts:36-43`. `canStartAttempt` does not validate its input. `maxAttempts` = NaN or undefined (for example from a nullable column through the adapter) makes `used >= max` false and returns `ok:true`, which fails open. This is inconsistent with `computeEndsAt`, `isExpired` and `roundScore`, which all validate. Fix: throw `EngineError("invalid_input")` when `usedAttempts` or `maxAttempts` is not a non-negative integer, and add a test.
- **[MINOR] m3:** `packages/engine/src/grade.test.ts:108-111`. The `__proto__` test only covers an empty answer sheet. Fix: add a positive case `JSON.parse('{"__proto__":["__proto__-a"]}')` that should count as correct.
- **[MINOR] m4:** `packages/engine/src/shuffle.ts:63-73`. `orderedBy` checks length and existence but not duplicates: `["q1","q1"]` with items q1,q2 passes, shows q1 twice and drops q2. The data normally comes from `shuffleAttempt`, so the risk is low. Fix: check `new Set(orderedIds).size === items.length`.
- **[NIT] n1:** `seededRng` (mulberry32) is duplicated in `draw.test.ts:5-15` and `shuffle.test.ts:13-23`. It could move to a shared test helper.
- **[NIT] n2:** `shuffle.test.ts:12` has the comment "LCG xác định", but the function is mulberry32.

## Residual risk
- Coverage ≥90% is unverified by tool: `@vitest/coverage-v8` is missing.
- Structural compatibility of `types.ts` with db/shared: no matching schema or enum found in `packages/db` or `packages/shared` (the Grep showed only engine matches). The DB enums (difficulty, class status, `is_correct` against `isCorrect`) may need a mapping in the api adapter. The task notes allow this.
- The api must handle resume (same cookie plus in_progress) before `canStartAttempt`, must use `isExpired(..., 0)` for the sweeper, must handle `officialScore` = null, and must enforce at least 1 correct answer per question.
- I did not check the Node version that provides `globalThis.crypto`.

## Verdict
**PASS**. No CRITICAL or MAJOR findings. The minors are fixes the builder can make in a later round or a later task.
