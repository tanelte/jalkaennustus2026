'use client';

import { KeyRound } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import { useAutoSave } from '@/lib/hooks/use-autosave';
import type { EditMode } from '@/lib/pin/edit-mode';
import { PeerViewPopover } from '@/components/peer-predictions/peer-view-popover';
import { PeerViewTrigger } from '@/components/peer-predictions/peer-view-trigger';
import type { PeerRow } from '@/lib/peer-predictions/load-peer-predictions';
import type { TriviaPeerAnswer } from '@/lib/peer-predictions/load-trivia-payloads';
import { saveTriviaAnswer } from './actions';
import { ANSWER_MAX_LEN } from './constants';

const TYPED_DEBOUNCE_MS = 800;

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt kasutaja.',
  invalid_position: 'Vormi viga — proovi uuesti.',
  invalid_integer: 'Numbriline vastus peab olema täisarv.',
  invalid_team: 'Vastus peab olema üks turniiri riikidest.',
  too_long: 'Vastus on liiga pikk.',
  unknown_question: 'Trivia küsimusi ei leitud — võta ühendust korraldajaga.',
  stage_closed: 'Trivia aken on suletud.',
  stage_not_yet: 'Trivia aken ei ole veel avatud.',
  stage_not_found: 'Trivia etappi ei leitud — võta ühendust korraldajaga.',
  pin_required:
    'PIN-i sessioon aegus. Värskenda lehte ja klõpsa Muuda nuppu uuesti.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
  network_error: 'Võrguviga — proovi uuesti.',
};

export interface TriviaQuestionRow {
  id: string;
  position: number;
  promptEt: string;
  answerShape: string;
  conditionalOnPosition: number | null;
  currentAnswer: string;
}

export interface TeamOption {
  code: string;
  name_et: string;
}

const INPUT_BASE =
  'mt-2 w-full rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

function buildRenderTriviaPick(
  answerShape: string,
  teamNameByCode: ReadonlyMap<string, string>,
) {
  return function renderTriviaPick(payload: TriviaPeerAnswer) {
    const display =
      answerShape === 'team' ? teamNameByCode.get(payload) ?? payload : payload;
    return (
      <span className="inline-flex items-center rounded-md border border-border-default bg-bg-app px-2 py-0.5 text-xs font-medium text-text-primary">
        {display}
      </span>
    );
  };
}

export function TriviaForm({
  questions,
  teams,
  mode,
  userId,
  maskedRecoveryEmail,
  groupName,
  peerRowsByQuestionId,
}: {
  questions: readonly TriviaQuestionRow[];
  teams: readonly TeamOption[];
  mode: EditMode;
  userId: string;
  maskedRecoveryEmail?: string | null;
  /** Current group's display name, used in the peer-view popover header. */
  groupName: string;
  /**
   * Peer rows per question. Keyed by `question_id`. The viewer + the
   * `tegelikud tulemused` singleton are already excluded by the read seam
   * (see `lib/peer-predictions/load-peer-predictions.ts`).
   */
  peerRowsByQuestionId: Record<string, PeerRow<TriviaPeerAnswer>[]>;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.position, q.currentAnswer])),
  );
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const autosave = useAutoSave();

  const disabled = mode !== 'edit';

  const teamNameByCode = useMemo(
    () => new Map(teams.map((t) => [t.code, t.name_et])),
    [teams],
  );

  function onChange(position: number, value: string, debounceMs: number) {
    setAnswers((prev) => ({ ...prev, [position]: value }));
    autosave.schedule(
      `q:${position}`,
      () => saveTriviaAnswer(position, value),
      { debounceMs },
    );
  }

  const errorMessage = autosave.errorCode
    ? ERROR_COPY[autosave.errorCode] ?? null
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SaveStatusIndicator
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          errorMessage={errorMessage}
        />
      </div>

      {questions.map((q) => {
        const inputId = `answer_${q.position}`;
        const isTeam = q.answerShape === 'team';
        const isInt = q.answerShape === 'integer';
        const helpId =
          q.conditionalOnPosition !== null ? `${inputId}-help` : undefined;
        const peerRows = peerRowsByQuestionId[q.id] ?? [];
        const submittedCount = peerRows.filter(
          (p) => p.submittedPayload !== null,
        ).length;
        const peerTotal = peerRows.length;
        return (
          <fieldset
            key={q.position}
            className="rounded-lg border border-border-default bg-surface-card p-4"
            aria-describedby={helpId}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <legend className="px-1 text-sm font-medium text-text-primary">
                Q{q.position}. {q.promptEt}
              </legend>
              {peerTotal > 0 && (
                <PeerViewPopover<TriviaPeerAnswer>
                  groupName={groupName}
                  peerRows={peerRows}
                  renderPick={buildRenderTriviaPick(q.answerShape, teamNameByCode)}
                  size="row"
                  trigger={
                    <PeerViewTrigger
                      n={submittedCount}
                      m={peerTotal}
                      size="row"
                      ariaLabel={`Vaata kaaslaste vastuseid Q${q.position} kohta — ${submittedCount} kaaslast ${peerTotal}-st on vastanud`}
                    />
                  }
                />
              )}
            </div>
            {q.conditionalOnPosition !== null && (
              <p id={helpId} className="mt-1 text-xs text-text-muted">
                Q{q.position} avaneb, kui Q{q.conditionalOnPosition} on
                salvestatud.
              </p>
            )}
            {isTeam ? (
              <select
                id={inputId}
                name={inputId}
                value={answers[q.position] ?? ''}
                onChange={(e) => onChange(q.position, e.target.value, 0)}
                disabled={disabled}
                className={INPUT_BASE}
              >
                <option value="" disabled>
                  Vali riik…
                </option>
                {teams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name_et}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={inputId}
                name={inputId}
                type={isInt ? 'number' : 'text'}
                inputMode={isInt ? 'numeric' : 'text'}
                maxLength={ANSWER_MAX_LEN}
                value={answers[q.position] ?? ''}
                onChange={(e) =>
                  onChange(q.position, e.target.value, TYPED_DEBOUNCE_MS)
                }
                disabled={disabled}
                className={INPUT_BASE}
              />
            )}
          </fieldset>
        );
      })}

      {mode !== 'edit' && (
        <div className="flex justify-end pt-2">
          {mode === 'closed' ? (
            <Badge
              variant="outline"
              className="border-state-closed-text bg-state-closed-bg text-state-closed-text"
            >
              Suletud
            </Badge>
          ) : (
            <Button
              type="button"
              onClick={() => setPinModalOpen(true)}
              aria-label="Sisesta PIN, et alustada muutmist"
              className="bg-brand-green hover:bg-brand-green-hover"
            >
              <KeyRound aria-hidden="true" />
              Muuda
            </Button>
          )}
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
