# S06 — Operator Admin: Match Result Entry + Best-Thirds Confirmation

**Story:** `S06-operator-admin-results-management` (epic E01-wc2026-rewrite)
**Implemented:** 2026-05-30

## What landed

- `users.is_operator BOOLEAN NOT NULL DEFAULT FALSE` — new admin-gate flag. Migration `0006_operator_flag.sql`.
- `lib/system-user.ts` — `getSystemUserId()` (React-cached) + pure `resolveSystemUserId(deps)`.
- `lib/operator/require-operator.ts` — `checkOperator(userId)` (app-side) + pure `assertOperator(userId, deps)`.
- `lib/recompute/match.ts` — pure `computeMatchRescoreInputs(game, userGames)` and the orchestrator `recomputeMatch(gameId, tx?)`. Returns `{ rescored, result_code, outcome, clear_reason? }`.
- `lib/recompute/best-thirds.ts` — pure `validateOfficialLetters(letters)` + `computeBestThirdsRescoreInputs(rows, officialSet)` and the orchestrator `recomputeBestThirds(tournamentId, systemUserId, letters, tx?)`.
- `/admin` — gated layout + landing page.
- `/admin/matches` — table of every WC2026 game grouped by stage; per-row score + status form; Server Action `submitMatchResult` upserts `games` row and calls `recomputeMatch` inside one transaction.
- `/admin/best-thirds` — 12-letter tick form; Server Action `confirmBestThirds` rejects while the player stage is open, else upserts the singleton's 8 official rows and rescores everyone via `recomputeBestThirds`.
- `scripts/promote-operator.ts` — CLI to flip `is_operator` on a username (`--revoke` to clear). Wired as `pnpm promote-operator -- --username <name>`.

## Verification (run from `client-projects/jalkaennustus2026/`)

```sh
pnpm lint        # ✔ no warnings or errors
pnpm typecheck   # ✔ no diagnostics
pnpm test        # ✔ 207 passed, 4 skipped (pre-existing leaderboard suite)
```

New tests covering the S06 surface:

- `lib/system-user.test.ts` — 2 tests.
- `lib/operator/require-operator.test.ts` — 4 tests.
- `lib/recompute/match.test.ts` — 13 tests across cleared paths + every (predicted × actual × double_points) class.
- `lib/recompute/best-thirds.test.ts` — 9 tests across the official-set guards + the binary per-row scoring.

The 100% coverage gate on `lib/scoring/**` is unaffected (no new files there).

## Manual E2E walkthrough (planned — perform during local-dev validation)

This walkthrough is the e2e proof the story scope requires. Run it against a fresh local DB (`supabase start && pnpm db:migrate && pnpm db:seed`) to validate the loop end-to-end before merging.

1. **Seed group + users + operator.**
   ```sh
   pnpm create-group -- --username demo --password "demo-passw0rd"
   # Add two players to that group (via /select-user → "+ lisa uus mängija"):
   #   mart, liisa
   pnpm promote-operator -- --username liisa
   ```

2. **Player picks (validates the existing S05 surface still works).** Log in as `demo`; select player `mart`; visit `/predict/best-thirds`; tick `A, B, C, D, E, F, G, H`; submit. SQL check:
   ```sql
   SELECT group_letter FROM user_best_thirds
   WHERE user_id = (SELECT id FROM users WHERE username='mart');
   ```
   Expect 8 rows, all with `points IS NULL`.

3. **Operator confirms a match result.** Switch to player `liisa`; the home page should now show an `/admin` link reachable in the URL. Visit `/admin/matches`; pick the first group-stage game (e.g. `A vs B Group Stage Round 1`); enter `2 – 1`, status `FINISHED`; click Salvesta.
   - The row's result code column should refresh to `1A`.
   - Log line should be a single JSON line: `operation=admin_submit_match_result, outcome=ok, predictions_rescored=<n>`.
   - SQL check:
     ```sql
     SELECT prediction, points FROM user_games WHERE game_id = '<id>';
     ```
     Every row should have a numeric `points` matching `scoreMatchPrediction` (5 for `1A`, 3 for `1B`, 0 otherwise).

4. **Correction path.** Resubmit the same game with `4 – 0`, `FINISHED` — result code flips to `1B`. Re-query `user_games.points`; rows now score 5 for `1B`, 3 for `1A`, 0 for the rest. No new rows; `predictions_rescored` logged again.

5. **Non-result path.** Submit `POSTPONED` (scores blank). SQL check: `games.result_code` is `NULL`, every `user_games.points` for that game is `NULL`. Log line `outcome=ok, rescore_outcome=cleared, clear_reason=incomplete`.

6. **Best-thirds confirmation — open-stage rejection.** Visit `/admin/best-thirds` while the best-thirds stage window is still open. Tick 8 letters; submit. Expect rejection: `stage_still_open`. Manually update the stage row to close it:
   ```sql
   UPDATE stages SET closes_at = now() - interval '1 hour'
   WHERE code = 'best_thirds';
   ```

7. **Best-thirds confirmation — happy path.** Resubmit on `/admin/best-thirds` with `A, B, C, D, E, F, G, H`. SQL check:
   ```sql
   SELECT u.username, ubt.group_letter, ubt.points
   FROM user_best_thirds ubt JOIN users u ON u.id = ubt.user_id
   WHERE ubt.tournament_id = (SELECT id FROM tournaments WHERE code='WC2026')
   ORDER BY u.username, ubt.group_letter;
   ```
   - The singleton (`tegelikud tulemused`) should own 8 rows, all with `points = 8`.
   - `mart`'s 8 rows should all show `points = 8` (he picked the same set).
   - Log line: `operation=admin_confirm_best_thirds, outcome=ok, predictions_rescored=<8>, affected_users=1`.

8. **Idempotent re-submit.** Submit the same 8 letters again on `/admin/best-thirds`. Re-query — row count unchanged (8 singleton rows total, not 16); points unchanged.

9. **Operator gate.** Log out; log back in; select player `mart`; visit `/admin` directly. Expect redirect to `/`. Log line: `operation=admin_gate, outcome=rejected, reason=not_operator`.

S07 (the leaderboard read surface) will then visualise these `points` values when it lands.

## Notes / decisions

- `recomputeMatch` always opens its own transaction when one isn't supplied. The admin action passes its outer `tx` so the `games` UPDATE and the per-`user_games` re-score commit atomically.
- "Attributed to *tegelikud tulemused*" is satisfied logically — the singleton owns official outcomes via the best-thirds row set; the per-match log line carries `operator_user_id`. No new attribution column was added to `games`; adding one would burden the schema with no read consumer.
- The match-result form accepts any of nine FeedStatus values (FINISHED/AWARDED/IN_PLAY/PAUSED/POSTPONED/CANCELLED/SUSPENDED/SCHEDULED/TIMED). `mapFeedToResultCode` distinguishes scorable from non-scorable; the orchestrator clears `result_code` and `points` on any non-scorable status.
- Best-thirds confirmation is gated by the **closed** stage state (operator confirms after the cutoff). Re-opening the stage to re-submit is intentionally manual and SQL-only.

---

## Addendum 2026-05-31 — knockout finish-type

S06's `/admin/matches` surface had no input for **how a knockout match was decided**, so it silently used the group-stage margin-based interpretation for `r32`/`r16`/`qf`/`sf`/`final` rows. Per the legacy DNA, the A/B suffix on knockout codes encodes **normal time vs extra time / penalties**, not margin. This addendum closes the gap.

### Changes

- **Migration `0007_finish_type.sql`** — adds `games.finish_type text NULL` with a CHECK constraint limiting values to `NORMAL_TIME` / `EXTRA_TIME` / `PENALTIES` (or NULL for group-stage rows).
- **`lib/scoring/result-code-knockout.ts`** — new pure mapper `mapKnockoutFeedToResultCode(match)`. Sibling to `result-code.ts`; equal scores yield `no-result/KNOCKOUT_TIE_INVALID`; otherwise `NORMAL_TIME → A`, `EXTRA_TIME` or `PENALTIES → B`. Never returns `X`. Tested in `result-code-knockout.test.ts` (19 cases).
- **`lib/recompute/match.ts`** — `GameForRescore` now carries `stage_code` and `finish_type`; orchestrator SELECT includes both. `computeMatchRescoreInputs` branches: `group_matches` → group mapper (unchanged); else → knockout mapper. New `ClearReason` variants: `missing_finish_type`, `invalid_finish_type`, `knockout_tie`. 8 new tests in `match.test.ts`.
- **`app/admin/matches/page.tsx`** — passes `stageCode` + `initialFinishType` to each form, plus a header hint explaining the A/B convention.
- **`app/admin/matches/match-result-form.tsx`** — conditional `Lõpetus` select (normaalaeg / lisaaeg / penaltid), rendered only when `stageCode !== 'group_matches'`.
- **`app/admin/matches/actions.ts`** — parses + validates `finish_type`; for group-stage rows it persists NULL regardless of any incoming value (defensive). Log line gains `stage_code`, `prior_finish_type`, `new_finish_type`, `clear_reason`. New error union members: `missing_finish_type`, `invalid_finish_type`. When the DB write succeeds but recompute returns `missing_finish_type`, the action surfaces it to the form so the operator gets a red prompt.

### Verification

- `pnpm test` → 234 passed, 4 skipped.
- `pnpm typecheck` → clean.
- `pnpm lint` → clean.

### Manual walkthrough (knockout row)

1. Visit `/admin/matches`; scroll to any `r32` / `r16` / `qf` / `sf` / `final` row — the new `Lõpetus` select is visible (group-stage rows have no select, unchanged).
2. Enter `2-1` + status `FINISHED` + leave `Lõpetus` empty → expect a red prompt asking for the finish type; `games.result_code` stays NULL.
3. Resubmit with `Lõpetus = Normaalaeg` → `result_code = '1A'`.
4. Resubmit with `Lõpetus = Lisaaeg` → `result_code = '1B'`.
5. Resubmit with `4-3` + `Lõpetus = Penaltid` → `result_code = '1B'`.
6. Resubmit with `1-1` + `Lõpetus = Normaalaeg` → row clears (knockout ties are invalid; operator must enter the deciding score).
7. Sanity SQL: `select round_label, score_home, score_away, finish_type, result_code from games where round_label = '<row>';`
