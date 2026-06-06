# Peer-Predictions Read Seam

Foundation for epic **E04 — Peer-Prediction Visibility**, established by story
**S01 — Group-stage match peer view**. Sibling stories S02–S05 reuse the same
seam for trivia, knockouts, best-thirds, and final.

## Architecture decisions (S01)

1. **Query shape — one shared seam, per-surface payload loaders.**
   `loadPeerPredictions<TPayload>` resolves the peer set once
   (group members minus the viewer minus the `tegelikud tulemused` singleton),
   then calls a surface-supplied `loadPayloads(peerIds)` to fetch the
   surface-specific value. Surfaces stay decoupled; the exclusion rule lives
   in one place.

2. **Session caching — none.** No bespoke cache, no client store. The peer
   set + payloads are loaded inside a Server Component and rely solely on
   Next.js per-request memoization. Re-renders within a session re-fetch.

3. **`n/m` refresh cadence — on-page-load only.** No polling, no realtime
   channel, no revalidation tag. The PRD explicitly avoids "tipster pressure"
   and the cost envelope precludes Supabase Realtime
   (Constitution Rule 12). If a future story argues otherwise, it lands as
   an architecture decision first.

## Files

- `load-peer-predictions.ts` — shared seam (DI-tested as
  `loadPeerPredictionsCore`); prod export `loadPeerPredictions`. Also exports
  `sortPeerRows(rows, mode)` and the `PeerSortMode` union.
- `load-group-stage-payloads.ts` — group-stage payload loader, single-game
  (`loadGroupStagePayloads`) and batched (`loadAllGroupStagePeerRowsForMatches`).
- `load-trivia-payloads.ts` — trivia payload loader.
- `load-best-thirds-payloads.ts` — best-thirds payload loader + the
  `isBestThirdsConsensus` set-equality predicate.
- `load-knockout-payloads.ts` — knockout payload loader.
- `load-final-payloads.ts` — final-stage payload loader + the
  `isFinalConsensus` ordered-equality predicate.
- `trigger-variant.ts` — pure UX-state classifier for the trigger chip.

UI components live under `components/peer-predictions/`.

## Architecture decisions (S06 — optional enhancements)

S06 adds three independent, backward-compatible enhancements on top of S01–S05:

4. **Per-peer score annotation.** Each surface's payload now carries
   `points: number | null` alongside the pick. The value is read verbatim from
   the existing `user_*.points` columns (`user_games.points`,
   `user_questions.points`, `user_best_thirds.points`, `user_teams.points`) —
   no recompute. The popover renders the value via the new optional
   `renderPoints(payload)` render-prop; surfaces that omit the prop hide the
   chip entirely. The value is identical to what the leaderboard already
   displays per peer (same column, no separate calculation).

5. **Consensus marker.** The popover accepts an optional `viewerPick` plus an
   optional per-surface `isConsensus(peer, viewer)` predicate. When the
   predicate returns true, the row gets a left border + soft brand tint —
   both pulled from the existing design-system tokens (`brand-green`,
   `brand-green-soft`); no new colors. Per-surface predicates:
   - Group-stage / trivia / knockouts: simple equality on the user-visible
     pick (1/X/2, normalized answer string, team id).
   - Best-thirds: set-equality on the 8 letters (order-insensitive).
   - Final: ordered equality on the F1→F4 team-id sequence (slot order
     matters — same as scoring).

6. **Peer ordering — alphabetical, applied uniformly.** The seam grew a new
   `sortMode: 'insertion' | 'alphabetical'` option (default `'insertion'` for
   back-compat). All five production surface loaders bind
   `sortMode: 'alphabetical'` so the peer list is sorted ascending by
   `peerName` (Estonian `localeCompare`, base sensitivity) across every
   surface uniformly. Insertion-order remains available for tests and any
   future caller that wants it. The sort is selected once and uniform
   per the S06 AC; switching to "by current standing" would require a
   leaderboard read and was deferred.
