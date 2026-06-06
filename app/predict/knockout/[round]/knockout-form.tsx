'use client';

import * as React from 'react';
import { useActionState, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SubmitButton } from '@/components/submit-button';
import { PeerViewPopover } from '@/components/peer-predictions/peer-view-popover';
import { PeerViewTrigger } from '@/components/peer-predictions/peer-view-trigger';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';
import type { KnockoutPeerPick } from '@/lib/peer-predictions/load-knockout-payloads';
import {
  submitKnockoutPicks,
  type SubmitKnockoutPicksState,
} from './actions';
import type { KnockoutPredictionCode, KnockoutRound } from './constants';

export interface KnockoutTeamView {
  id: string;
  code: string;
  name_et: string;
}

export interface KnockoutMatchView {
  id: string;
  roundLabel: string;
  kickoffAt: string;
  homeTeam: KnockoutTeamView | null;
  awayTeam: KnockoutTeamView | null;
  currentPrediction: string | null;
}

const initialState: SubmitKnockoutPicksState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  invalid_round: 'Tundmatu vooru kood.',
  invalid_prediction: 'Vigane valik — palun proovi uuesti.',
  unknown_game: 'Mängu ei leitud.',
  wrong_round: 'Mäng ei kuulu sellesse vooru.',
  tbd_pair: 'Mängu meeskonnad pole veel teada — valikut ei saa salvestada.',
  stage_closed: 'Selle vooru aken on suletud.',
  stage_not_yet: 'Selle vooru aken pole veel avatud.',
  stage_not_found: 'Selle vooru etappi ei leitud — võta ühendust korraldajaga.',
  pin_required: 'Sisesta oma PIN, et muudatusi salvestada.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
};

const OPTION_LABELS: Record<KnockoutPredictionCode, string> = {
  '1A': 'kodumeeskond — normaalaeg',
  '1B': 'kodumeeskond — lisaaeg / penaltid',
  '2A': 'võõrsil meeskond — normaalaeg',
  '2B': 'võõrsil meeskond — lisaaeg / penaltid',
};

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  // Local-ish display in Estonian DD.MM HH:mm. The server-rendered string is
  // hydration-safe because we pass the ISO string through and let the client
  // format identically.
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm} ${hh}:${mn} UTC`;
}

interface MatchRowProps {
  match: KnockoutMatchView;
  pick: string | null;
  onPick: (gameId: string, code: KnockoutPredictionCode) => void;
  disabled: boolean;
  peerRows: PeerRow<KnockoutPeerPick>[];
  groupName: string;
}

/**
 * Renders one peer's team-pick chip inside the popover. Mirrors the styling
 * of the form's own selected team-pick chip (brand-green pill) — but at the
 * popover's smaller scale, so it sits naturally beside the peer's name.
 *
 * S04 AC: "the team they picked to advance from that pair is shown".
 */
function renderKnockoutPick(payload: KnockoutPeerPick) {
  return (
    <span className="inline-flex items-center rounded-md border border-brand-green/30 bg-brand-green-soft px-2 py-0.5 text-xs font-medium text-brand-green">
      {payload.teamName}
    </span>
  );
}

/**
 * S06 per-peer score annotation. Verbatim `user_games.points`; null while
 * the knockout match has not been scored yet → popover hides the chip.
 */
function renderKnockoutPoints(payload: KnockoutPeerPick): React.ReactNode {
  if (payload.points === null) return null;
  return (
    <span className="ml-2 inline-flex h-6 items-center rounded-md bg-bg-app px-1.5 text-xs font-medium tabular-nums text-text-muted">
      {payload.points} p
    </span>
  );
}

/**
 * S06 consensus predicate. Two peers agree iff they picked the same team
 * (regardless of normaalaeg vs lisaaeg — the popover only renders the team
 * name; the user-visible value is the team, not the regulation/ET split).
 */
function isKnockoutConsensus(
  peer: KnockoutPeerPick,
  viewer: KnockoutPeerPick,
): boolean {
  return peer.teamId === viewer.teamId;
}

/**
 * Map the form's selected 1A/1B/2A/2B code into the `KnockoutPeerPick`
 * shape so the popover can compare directly.
 */
function viewerPickFromCode(
  code: string | null,
  match: { homeTeam: KnockoutTeamView | null; awayTeam: KnockoutTeamView | null },
): KnockoutPeerPick | null {
  if (!code) return null;
  const head = code[0];
  if (head === '1' && match.homeTeam) {
    return {
      teamId: match.homeTeam.id,
      teamName: match.homeTeam.name_et,
      points: null,
    };
  }
  if (head === '2' && match.awayTeam) {
    return {
      teamId: match.awayTeam.id,
      teamName: match.awayTeam.name_et,
      points: null,
    };
  }
  return null;
}

function MatchRow({
  match,
  pick,
  onPick,
  disabled,
  peerRows,
  groupName,
}: MatchRowProps) {
  const isTbd = match.homeTeam === null || match.awayTeam === null;
  const homeLabel = match.homeTeam ? match.homeTeam.name_et : 'TBD';
  const awayLabel = match.awayTeam ? match.awayTeam.name_et : 'TBD';
  const submittedCount = peerRows.filter(
    (p) => p.submittedPayload !== null,
  ).length;
  const peerTotal = peerRows.length;

  return (
    <fieldset
      className={`rounded-lg border border-border-default p-3 ${
        isTbd ? 'bg-bg-app' : 'bg-surface-card'
      }`}
      disabled={isTbd || disabled}
    >
      <legend className="px-1 text-xs uppercase tracking-wide text-text-muted">
        {match.roundLabel} — {formatKickoff(match.kickoffAt)}
      </legend>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-text-primary">
          {homeLabel} <span className="text-text-muted">vs</span> {awayLabel}
        </div>
        {peerTotal > 0 && (
          <PeerViewPopover<KnockoutPeerPick>
            groupName={groupName}
            peerRows={peerRows}
            renderPick={renderKnockoutPick}
            renderPoints={renderKnockoutPoints}
            viewerPick={viewerPickFromCode(pick, match)}
            isConsensus={isKnockoutConsensus}
            size="row"
            trigger={
              <PeerViewTrigger
                n={submittedCount}
                m={peerTotal}
                size="row"
              />
            }
          />
        )}
      </div>

      {isTbd ? (
        <p className="mt-2 text-xs text-text-muted">
          Meeskonnad selguvad eelmise vooru tulemuste järel.
        </p>
      ) : (
        <div
          className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2"
          role="radiogroup"
          aria-label={`${homeLabel} vs ${awayLabel}`}
        >
          {(['1A', '1B', '2A', '2B'] as const).map((code) => {
            const checked = pick === code;
            // Substitute the team name into the legend so the options are
            // unambiguous: "Brasiilia — normaalaeg".
            const teamLabel =
              code[0] === '1' ? match.homeTeam!.name_et : match.awayTeam!.name_et;
            const mode = code[1] === 'A' ? 'normaalaeg' : 'lisaaeg / penaltid';
            return (
              <label
                key={code}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  checked
                    ? 'border-brand-green bg-brand-green text-white'
                    : 'border-border-default bg-surface-card text-text-body hover:border-brand-green/40'
                }`}
              >
                <input
                  type="radio"
                  name={`pick:${match.id}`}
                  value={code}
                  checked={checked}
                  onChange={() => onPick(match.id, code)}
                  className="sr-only"
                />
                <span>
                  {teamLabel} — {mode}
                </span>
                <span className="sr-only">{OPTION_LABELS[code]}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export interface KnockoutFormProps {
  round: KnockoutRound;
  matches: readonly KnockoutMatchView[];
  disabled: boolean;
  gateClosed?: boolean;
  userId: string;
  maskedRecoveryEmail?: string | null;
  /** Current group's display name, used in the peer-view popover header. */
  groupName: string;
  /**
   * Peer rows per bracket pair. Keyed by `game_id` (each knockout match is
   * one bracket pair). The viewer + the `tegelikud tulemused` singleton are
   * already filtered out by the seam.
   */
  peerRowsBySlotKey: Record<string, PeerRow<KnockoutPeerPick>[]>;
}

export function KnockoutForm({
  round,
  matches,
  disabled,
  gateClosed = false,
  userId,
  maskedRecoveryEmail,
  groupName,
  peerRowsBySlotKey,
}: KnockoutFormProps) {
  const [state, formAction, pending] = useActionState(
    submitKnockoutPicks,
    initialState,
  );
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const m of matches) {
      if (m.currentPrediction) seed[m.id] = m.currentPrediction;
    }
    return seed;
  });
  const [pinModalOpen, setPinModalOpen] = useState(false);

  useEffect(() => {
    if (state.error === 'pin_required') setPinModalOpen(true);
  }, [state.error]);

  function onPick(gameId: string, code: KnockoutPredictionCode) {
    setPicks((prev) => ({ ...prev, [gameId]: code }));
  }

  const totalPickable = matches.filter(
    (m) => m.homeTeam !== null && m.awayTeam !== null,
  ).length;
  const pickedCount = Object.keys(picks).length;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="round" value={round} />

      <div className="space-y-3">
        {matches.map((m) => (
          <MatchRow
            key={m.id}
            match={m}
            pick={picks[m.id] ?? null}
            onPick={onPick}
            disabled={disabled}
            peerRows={peerRowsBySlotKey[m.id] ?? []}
            groupName={groupName}
          />
        ))}
      </div>

      <p className="text-sm text-text-muted" aria-live="polite">
        Valitud: <strong className="text-text-primary">{pickedCount}</strong>{' '}
        / {totalPickable}
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-state-closed-text">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-brand-green">
          Ennustus salvestatud.
        </p>
      )}

      <div className="flex justify-end pt-2">
        {gateClosed ? (
          <Badge
            variant="outline"
            className="border-state-closed-text bg-state-closed-bg text-state-closed-text"
          >
            Suletud
          </Badge>
        ) : (
          <SubmitButton
            pendingOverride={pending}
            disabled={pickedCount === 0}
            className="bg-brand-green hover:bg-brand-green-hover"
          >
            Salvesta valikud
          </SubmitButton>
        )}
      </div>
      <PinEntryModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        userId={userId}
        maskedRecoveryEmail={maskedRecoveryEmail}
      />
    </form>
  );
}
