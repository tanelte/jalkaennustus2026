'use client';

import { ChevronDown } from 'lucide-react';
import { useActionState, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { SubmitButton } from '@/components/submit-button';
import {
  submitGroupStagePredictions,
  type SubmitGroupStagePredictionsState,
} from './actions';
import {
  GROUP_LETTERS,
  GROUP_STAGE_OPTION_MODE_LABELS,
  GROUP_STAGE_PREDICTION_CODES,
  type GroupLetter,
  type GroupStagePredictionCode,
} from './constants';

export interface TeamView {
  id: string;
  code: string;
  name_et: string;
}

export interface MatchResultView {
  resultCode: GroupStagePredictionCode;
  resultLabelEt: string;
  scoreHome: number | null;
  scoreAway: number | null;
  points: number | null;
  outcome: 'exact' | 'winner' | 'miss' | null;
}

export interface GroupStageMatchView {
  id: string;
  groupLetter: GroupLetter;
  roundLabel: string;
  kickoffAt: string;
  doublePoints: boolean;
  homeTeam: TeamView;
  awayTeam: TeamView;
  currentPrediction: GroupStagePredictionCode | null;
  result: MatchResultView | null;
}

const initialState: SubmitGroupStagePredictionsState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  invalid_prediction: 'Vigane valik — palun proovi uuesti.',
  unknown_game: 'Mängu ei leitud.',
  wrong_stage: 'Mäng ei kuulu grupimängude etappi.',
  stage_closed: 'Grupimängude aken on suletud.',
  stage_not_yet: 'Grupimängude aken pole veel avatud.',
  stage_not_found: 'Grupimängude etappi ei leitud — võta ühendust korraldajaga.',
};

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}.${mm} ${hh}:${mn} UTC`;
}

function teamLabelForCode(
  code: GroupStagePredictionCode,
  home: TeamView,
  away: TeamView,
): string {
  if (code === 'X') return 'Viik';
  const team = code[0] === '1' ? home : away;
  const margin = code[1] === 'A' ? '1-2 väravaga' : '3+ väravaga';
  return `${team.name_et} võit ${margin}`;
}

// Tight secondary caption for the chip: margin only (full label is in aria).
function shortCaptionForCode(code: GroupStagePredictionCode): string {
  if (code === 'X') return 'viik';
  return code[1] === 'A' ? '1–2' : '3+';
}

interface MatchRowProps {
  match: GroupStageMatchView;
  pick: GroupStagePredictionCode | null;
  onPick: (gameId: string, code: GroupStagePredictionCode) => void;
  disabled: boolean;
}

function MatchRow({ match, pick, onPick, disabled }: MatchRowProps) {
  const { homeTeam, awayTeam, result } = match;

  return (
    <fieldset
      className="rounded-lg border border-border-default bg-surface-card p-3"
      disabled={disabled}
    >
      <legend className="flex flex-wrap items-center gap-2 px-1 text-xs uppercase tracking-wide text-text-muted">
        <span>
          {match.roundLabel} — {formatKickoff(match.kickoffAt)}
        </span>
        {match.doublePoints && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 px-2 py-0 text-[10px] font-semibold text-amber-900"
            aria-label="topeltpunktid"
          >
            2×
          </Badge>
        )}
      </legend>

      <div className="text-sm font-medium text-text-primary">
        {homeTeam.name_et}{' '}
        <span className="text-text-muted">vs</span> {awayTeam.name_et}
      </div>

      <div
        className="mt-3 grid grid-cols-5 gap-1 text-sm"
        role="radiogroup"
        aria-label={`${homeTeam.name_et} vs ${awayTeam.name_et}`}
      >
        {GROUP_STAGE_PREDICTION_CODES.map((code) => {
          const checked = pick === code;
          const fullLabel = teamLabelForCode(code, homeTeam, awayTeam);
          return (
            <label
              key={code}
              title={fullLabel}
              aria-label={fullLabel}
              className={`flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-1.5 text-center transition-colors ${
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
              <span className="text-sm font-bold leading-none tabular-nums">
                {code}
              </span>
              <span
                className={`mt-0.5 text-[10px] leading-tight ${
                  checked ? 'text-white/85' : 'text-text-muted'
                }`}
              >
                {shortCaptionForCode(code)}
              </span>
              <span className="sr-only">{GROUP_STAGE_OPTION_MODE_LABELS[code]}</span>
            </label>
          );
        })}
      </div>

      {result && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-default pt-2 text-sm text-text-body">
          <span className="font-medium text-text-primary">
            Tulemus: {result.scoreHome ?? '?'} – {result.scoreAway ?? '?'}
          </span>
          {result.points !== null && (
            <Badge
              variant="outline"
              className={
                result.points > 0
                  ? 'border-brand-green/30 bg-brand-green-soft text-brand-green'
                  : 'border-border-default bg-bg-app text-text-muted'
              }
            >
              {result.points > 0 ? '+' : ''}
              {result.points}p
              {match.doublePoints && result.points > 0 && (
                <span className="ml-1" aria-label="topeltpunktid arvestatud">
                  (2×)
                </span>
              )}
            </Badge>
          )}
        </div>
      )}
    </fieldset>
  );
}

export interface GroupStageFormProps {
  matches: readonly GroupStageMatchView[];
  disabled: boolean;
  gateClosed?: boolean;
}

export function GroupStageForm({
  matches,
  disabled,
  gateClosed = false,
}: GroupStageFormProps) {
  const [state, formAction, pending] = useActionState(
    submitGroupStagePredictions,
    initialState,
  );
  const [picks, setPicks] = useState<Record<string, GroupStagePredictionCode>>(() => {
    const seed: Record<string, GroupStagePredictionCode> = {};
    for (const m of matches) {
      if (m.currentPrediction) seed[m.id] = m.currentPrediction;
    }
    return seed;
  });

  function onPick(gameId: string, code: GroupStagePredictionCode) {
    setPicks((prev) => ({ ...prev, [gameId]: code }));
  }

  const matchesByLetter = new Map<GroupLetter, GroupStageMatchView[]>();
  for (const letter of GROUP_LETTERS) matchesByLetter.set(letter, []);
  for (const m of matches) {
    const bucket = matchesByLetter.get(m.groupLetter);
    if (bucket) bucket.push(m);
  }

  const totalCount = matches.length;
  const pickedCount = Object.keys(picks).length;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {GROUP_LETTERS.map((letter) => {
          const groupMatches = matchesByLetter.get(letter) ?? [];
          if (groupMatches.length === 0) return null;
          const groupPicked = groupMatches.filter((m) => picks[m.id]).length;
          return (
            <details
              key={letter}
              open
              className="group rounded-lg border border-border-default bg-surface-card"
            >
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-text-primary marker:hidden hover:bg-bg-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <span>
                  Grupp {letter}{' '}
                  <span className="ml-1 text-xs font-normal text-text-muted">
                    ({groupPicked} / {groupMatches.length})
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="space-y-2 border-t border-border-default px-3 py-3">
                {groupMatches.map((m) => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    pick={picks[m.id] ?? null}
                    onPick={onPick}
                    disabled={disabled}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <p className="text-sm text-text-muted" aria-live="polite">
        Esitatud: <strong className="text-text-primary">{pickedCount}</strong>{' '}
        / {totalCount}
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-state-closed-text">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-brand-green">
          Ennustus salvestatud ({state.picks_written ?? 0} mängu).
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
    </form>
  );
}
