'use client';

import { startTransition, useActionState, useState } from 'react';

import { SubmitButton } from '@/components/submit-button';
import { Input } from '@/components/ui/input';
import { submitMatchResult, type SubmitMatchResultState } from './actions';

const initialState: SubmitMatchResultState = {};

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  not_operator: 'Operaatori õigused puuduvad.',
  game_not_found: 'Mängu ei leitud.',
  invalid_score: 'Skoor peab olema täisarv vahemikus 0–99.',
  invalid_status: 'Tundmatu mängu staatus.',
  missing_finish_type:
    'Vali lõpetus (normaalaeg / lisaaeg / penaltid) — knockoutmängu tulemuse arvutamiseks on see vajalik.',
  invalid_finish_type: 'Tundmatu lõpetus.',
};

const FINISH_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '— vali lõpetus —' },
  { value: 'NORMAL_TIME', label: 'Normaalaeg' },
  { value: 'EXTRA_TIME', label: 'Lisaaeg' },
  { value: 'PENALTIES', label: 'Penaltid' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '— vali staatus —' },
  { value: 'FINISHED', label: 'FINISHED — lõppskoor kinnitatud' },
  { value: 'AWARDED', label: 'AWARDED — tehniline võit' },
  { value: 'IN_PLAY', label: 'IN_PLAY — mäng käib' },
  { value: 'PAUSED', label: 'PAUSED — vaheaeg' },
  { value: 'POSTPONED', label: 'POSTPONED — edasi lükatud' },
  { value: 'CANCELLED', label: 'CANCELLED — tühistatud' },
  { value: 'SUSPENDED', label: 'SUSPENDED — peatatud' },
  { value: 'SCHEDULED', label: 'SCHEDULED — planeeritud' },
  { value: 'TIMED', label: 'TIMED — aeg paigas' },
];

export interface MatchResultFormProps {
  gameId: string;
  stageCode: string;
  initialScoreHome: number | null;
  initialScoreAway: number | null;
  initialFinalStatus: string | null;
  initialFinishType: string | null;
}

const GROUP_STAGE_CODE = 'group_matches';

const SELECT_CLASSES =
  'h-9 rounded-md border border-border-default bg-surface-card px-2 py-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export function MatchResultForm(props: MatchResultFormProps) {
  const [state, formAction, pending] = useActionState(submitMatchResult, initialState);
  const matched = state.game_id === props.gameId;
  const isKnockout = props.stageCode !== GROUP_STAGE_CODE;

  // Controlled fields: React 19's <form action=…> resets uncontrolled inputs to
  // their defaultValue after a successful submit, which (combined with the
  // client component staying mounted) reverts dropdowns to their pre-edit
  // value until a full refresh. Controlling the value keeps the user's
  // selection visible immediately after Save.
  const [scoreHome, setScoreHome] = useState<string>(
    props.initialScoreHome !== null ? String(props.initialScoreHome) : '',
  );
  const [scoreAway, setScoreAway] = useState<string>(
    props.initialScoreAway !== null ? String(props.initialScoreAway) : '',
  );
  const [finalStatus, setFinalStatus] = useState<string>(props.initialFinalStatus ?? '');
  const [finishType, setFinishType] = useState<string>(props.initialFinishType ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // Calling formAction via onSubmit (instead of binding `action={formAction}`)
        // sidesteps React 19's <form action> auto-reset, which mangles the
        // <select> value via the option's defaultSelected attribute on save.
        // The startTransition wrapper keeps useActionState's `pending` accurate.
        startTransition(() => formAction(formData));
      }}
      className="flex flex-wrap items-center gap-2 text-sm"
      noValidate
    >
      <input type="hidden" name="game_id" value={props.gameId} />
      <Input
        type="number"
        name="score_home"
        min={0}
        max={99}
        value={scoreHome}
        onChange={(e) => setScoreHome(e.target.value)}
        className="w-16 tabular-nums"
        aria-label="Kodumeeskonna skoor"
      />
      <span aria-hidden className="text-text-muted">–</span>
      <Input
        type="number"
        name="score_away"
        min={0}
        max={99}
        value={scoreAway}
        onChange={(e) => setScoreAway(e.target.value)}
        className="w-16 tabular-nums"
        aria-label="Võõrsil meeskonna skoor"
      />
      <label className="flex items-center gap-1">
        <span className="sr-only">Staatus</span>
        <select
          name="final_status"
          value={finalStatus}
          onChange={(e) => setFinalStatus(e.target.value)}
          className={SELECT_CLASSES}
          aria-label="Mängu staatus"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {isKnockout && (
        <label className="flex items-center gap-1">
          <span className="sr-only">Lõpetus</span>
          <select
            name="finish_type"
            value={finishType}
            onChange={(e) => setFinishType(e.target.value)}
            className={SELECT_CLASSES}
            aria-label="Lõpetus (normaalaeg / lisaaeg / penaltid)"
            title="Knockoutmängu lõpetus: A = normaalaeg, B = lisaaeg või penaltid. Penalti-mängu puhul märgi penaltisuhe skooriks (nt 4-3)."
          >
            {FINISH_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <SubmitButton
        pendingOverride={pending}
        size="sm"
        className="bg-brand-green hover:bg-brand-green-hover"
      >
        Salvesta
      </SubmitButton>
      {matched && state.error && ERROR_COPY[state.error] && (
        <span role="alert" className="text-state-closed-text">
          {ERROR_COPY[state.error]}
        </span>
      )}
      {matched && state.ok && (
        <span role="status" className="text-brand-green">
          Salvestatud.
        </span>
      )}
    </form>
  );
}
