'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { EditUnlockBanner } from '@/components/pin/edit-unlock-banner';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import { useAutoSave } from '@/lib/hooks/use-autosave';
import type { EditMode } from '@/lib/pin/edit-mode';
import { PeerViewPopover } from '@/components/peer-predictions/peer-view-popover';
import { PeerViewTrigger } from '@/components/peer-predictions/peer-view-trigger';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';
import type { KnockoutPeerPick } from '@/lib/peer-predictions/load-knockout-payloads';
import { saveKnockoutPick } from './actions';
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
  pin_required:
    'PIN-i sessioon aegus. Värskenda lehte ja klõpsa Muuda nuppu uuesti.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
  network_error: 'Võrguviga — proovi uuesti.',
};

const OPTION_LABELS: Record<KnockoutPredictionCode, string> = {
  '1A': 'kodumeeskond — normaalaeg',
  '1B': 'kodumeeskond — lisaaeg / penaltid',
  '2A': 'külalismeeskond — normaalaeg',
  '2B': 'külalismeeskond — lisaaeg / penaltid',
};

function formatKickoff(iso: string): string {
  const d = new Date(iso);
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

function renderKnockoutPick(payload: KnockoutPeerPick) {
  return (
    <span className="inline-flex items-center rounded-md border border-brand-green/30 bg-brand-green-soft px-2 py-0.5 text-xs font-medium text-brand-green">
      {payload.teamName}
    </span>
  );
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
                  disabled={isTbd || disabled}
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
  mode: EditMode;
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
  mode,
  userId,
  maskedRecoveryEmail,
  groupName,
  peerRowsBySlotKey,
}: KnockoutFormProps) {
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const m of matches) {
      if (m.currentPrediction) seed[m.id] = m.currentPrediction;
    }
    return seed;
  });
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const autosave = useAutoSave();

  const disabled = mode !== 'edit';

  function onPick(gameId: string, code: KnockoutPredictionCode) {
    setPicks((prev) => ({ ...prev, [gameId]: code }));
    autosave.schedule(`pick:${gameId}`, () =>
      saveKnockoutPick(round, gameId, code),
    );
  }

  const totalPickable = matches.filter(
    (m) => m.homeTeam !== null && m.awayTeam !== null,
  ).length;
  const pickedCount = Object.keys(picks).length;
  const errorMessage = autosave.errorCode
    ? ERROR_COPY[autosave.errorCode] ?? null
    : null;

  return (
    <div className="space-y-3">
      {mode === 'pending-unlock' && (
        <EditUnlockBanner onUnlockClick={() => setPinModalOpen(true)} />
      )}

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-bg-app px-4 py-2 shadow-[0_4px_8px_-6px_rgba(0,0,0,0.12)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p className="text-sm text-text-muted" aria-live="polite">
          Valitud: <strong className="text-text-primary">{pickedCount}</strong>{' '}
          / {totalPickable}
        </p>
        <SaveStatusIndicator
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          errorMessage={errorMessage}
        />
      </div>

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

      {mode === 'closed' && (
        <div className="flex justify-end pt-2">
          <Badge
            variant="outline"
            className="border-state-closed-text bg-state-closed-bg text-state-closed-text"
          >
            Suletud
          </Badge>
        </div>
      )}

      <PinEntryModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        userId={userId}
        maskedRecoveryEmail={maskedRecoveryEmail}
      />
    </div>
  );
}
