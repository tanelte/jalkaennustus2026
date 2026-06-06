'use client';

import { useActionState, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SubmitButton } from '@/components/submit-button';
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
}

function MatchRow({ match, pick, onPick, disabled }: MatchRowProps) {
  const isTbd = match.homeTeam === null || match.awayTeam === null;
  const homeLabel = match.homeTeam ? match.homeTeam.name_et : 'TBD';
  const awayLabel = match.awayTeam ? match.awayTeam.name_et : 'TBD';

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
      <div className="text-sm font-medium text-text-primary">
        {homeLabel} <span className="text-text-muted">vs</span> {awayLabel}
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
}

export function KnockoutForm({
  round,
  matches,
  disabled,
  gateClosed = false,
  userId,
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
      />
    </form>
  );
}
