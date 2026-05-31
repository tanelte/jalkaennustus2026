'use client';

import { useActionState, useState } from 'react';
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

interface MatchRowProps {
  match: GroupStageMatchView;
  pick: GroupStagePredictionCode | null;
  onPick: (gameId: string, code: GroupStagePredictionCode) => void;
  disabled: boolean;
}

function MatchRow({ match, pick, onPick, disabled }: MatchRowProps) {
  const { homeTeam, awayTeam, result } = match;

  return (
    <fieldset className="rounded border bg-white p-3" disabled={disabled}>
      <legend className="flex flex-wrap items-center gap-2 px-1 text-xs uppercase tracking-wide text-gray-500">
        <span>
          {match.roundLabel} — {formatKickoff(match.kickoffAt)}
        </span>
        {match.doublePoints && (
          <span
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
            aria-label="topeltpunktid"
          >
            2×
          </span>
        )}
      </legend>

      <div className="text-sm font-medium text-gray-900">
        {homeTeam.name_et} <span className="text-gray-400">vs</span> {awayTeam.name_et}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-5">
        {GROUP_STAGE_PREDICTION_CODES.map((code) => {
          const checked = pick === code;
          return (
            <label
              key={code}
              className={`flex cursor-pointer items-center justify-center rounded border px-2 py-1 text-center ${
                checked
                  ? 'border-black bg-black text-white'
                  : 'border-gray-300 bg-white text-gray-900'
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
              <span>{teamLabelForCode(code, homeTeam, awayTeam)}</span>
              <span className="sr-only">{GROUP_STAGE_OPTION_MODE_LABELS[code]}</span>
            </label>
          );
        })}
      </div>

      {result && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-200 pt-2 text-sm text-gray-700">
          <span className="font-medium text-gray-900">
            Tulemus: {result.scoreHome ?? '?'} – {result.scoreAway ?? '?'}
          </span>
          {result.points !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                result.points > 0
                  ? 'bg-green-50 text-green-900'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {result.points > 0 ? '+' : ''}
              {result.points}p
              {match.doublePoints && result.points > 0 && (
                <span className="ml-1" aria-label="topeltpunktid arvestatud">
                  (2×)
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </fieldset>
  );
}

export interface GroupStageFormProps {
  matches: readonly GroupStageMatchView[];
  disabled: boolean;
}

export function GroupStageForm({ matches, disabled }: GroupStageFormProps) {
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
    <form action={formAction} className="mt-6 space-y-6" noValidate>
      {GROUP_LETTERS.map((letter) => {
        const groupMatches = matchesByLetter.get(letter) ?? [];
        if (groupMatches.length === 0) return null;
        return (
          <section key={letter} aria-labelledby={`group-${letter}-heading`}>
            <h2
              id={`group-${letter}-heading`}
              className="text-lg font-semibold text-gray-900"
            >
              Grupp {letter}
            </h2>
            <div className="mt-2 space-y-2">
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
          </section>
        );
      })}

      <p className="text-sm text-gray-600" aria-live="polite">
        Esitatud: <strong>{pickedCount}</strong> / {totalCount}
      </p>

      {state.error && ERROR_COPY[state.error] && (
        <p role="alert" className="text-sm text-red-700">
          {ERROR_COPY[state.error]}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-green-700">
          Ennustus salvestatud ({state.picks_written ?? 0} mängu).
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || pending || pickedCount === 0}
        className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Salvestan…' : 'Salvesta valikud'}
      </button>
    </form>
  );
}
