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
  `loadPeerPredictionsCore`); prod export `loadPeerPredictions`.
- `load-group-stage-payloads.ts` — group-stage payload loader, single-game
  (`loadGroupStagePayloads`) and batched (`loadAllGroupStagePeerRowsForMatches`).
- `trigger-variant.ts` — pure UX-state classifier for the trigger chip.

UI components live under `components/peer-predictions/`.
