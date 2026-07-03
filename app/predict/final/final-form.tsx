'use client';

import { Medal } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { EditUnlockBanner } from '@/components/pin/edit-unlock-banner';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import { useAutoSave } from '@/lib/hooks/use-autosave';
import type { EditMode } from '@/lib/pin/edit-mode';
import { saveFinalSlot } from './actions';
import {
  FINAL_SLOT_LABELS_ET,
  FORM_FIELD_PREFIX,
  type FinalSlot,
} from './constants';
import type { FinalResultsView } from './result-view';

export interface CandidateTeamView {
  id: string;
  code: string;
  name_et: string;
}

const ERROR_COPY: Record<string, string> = {
  no_session: 'Logi sisse uuesti.',
  no_user: 'Vali kõigepealt mängija.',
  invalid_slot: 'Vigane lahter — proovi uuesti.',
  unknown_team: 'Valitud meeskond ei kuulu sellesse turniiri.',
  stage_closed: 'Finaali ennustuse aken on suletud.',
  stage_not_yet: 'Finaali ennustuse aken ei ole veel avatud.',
  stage_not_found: 'Finaali etappi ei leitud — võta ühendust korraldajaga.',
  pin_required:
    'PIN-i sessioon aegus. Värskenda lehte ja klõpsa Muuda nuppu uuesti.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
  network_error: 'Võrguviga — proovi uuesti.',
};

const MEDAL_TONE: Record<FinalSlot, string> = {
  F1: 'text-yellow-500',
  F2: 'text-gray-400',
  F3: 'text-amber-700',
  F4: 'text-text-muted',
};

export interface FinalFormProps {
  candidates: readonly CandidateTeamView[];
  initialPicks: Partial<Record<FinalSlot, string>>;
  slotsOrder: readonly FinalSlot[];
  mode: EditMode;
  userId: string;
  maskedRecoveryEmail?: string | null;
  /**
   * Per-slot official standings + earned points, once results are confirmed.
   * Null until the operator sets all four medal positions.
   */
  results?: FinalResultsView | null;
}

export function FinalForm({
  candidates,
  initialPicks,
  slotsOrder,
  mode,
  userId,
  maskedRecoveryEmail,
  results,
}: FinalFormProps) {
  const [picks, setPicks] = useState<Partial<Record<FinalSlot, string>>>(initialPicks);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const autosave = useAutoSave();

  const disabled = mode !== 'edit';

  function onPick(slot: FinalSlot, teamId: string) {
    const normalized = teamId || undefined;
    setPicks((prev) => ({ ...prev, [slot]: normalized }));
    autosave.schedule(`slot:${slot}`, () =>
      saveFinalSlot(slot, normalized ?? null),
    );
  }

  const filledCount = slotsOrder.filter((s) => picks[s]).length;
  const errorMessage = autosave.errorCode
    ? ERROR_COPY[autosave.errorCode] ?? null
    : null;

  return (
    <div className="space-y-5">
      {mode === 'pending-unlock' && (
        <EditUnlockBanner onUnlockClick={() => setPinModalOpen(true)} />
      )}

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 shadow-[0_4px_8px_-6px_rgba(0,0,0,0.12)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <p className="text-sm text-text-muted" aria-live="polite">
          Valitud:{' '}
          <strong className="text-text-primary">
            {filledCount} / {slotsOrder.length}
          </strong>
        </p>
        <SaveStatusIndicator
          status={autosave.status}
          lastSavedAt={autosave.lastSavedAt}
          errorMessage={errorMessage}
        />
      </div>

      <div className="space-y-3">
        {slotsOrder.map((slot) => {
          const inputId = `${FORM_FIELD_PREFIX}${slot}`;
          const slotResult = results?.[slot] ?? null;
          return (
            <div
              key={slot}
              className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-card p-4"
            >
              <label
                htmlFor={inputId}
                className="flex items-center gap-2 text-sm font-medium text-text-primary"
              >
                <Medal
                  aria-hidden="true"
                  className={`h-4 w-4 ${MEDAL_TONE[slot]}`}
                />
                {FINAL_SLOT_LABELS_ET[slot]}
              </label>
              <select
                id={inputId}
                name={inputId}
                value={picks[slot] ?? ''}
                disabled={disabled}
                onChange={(e) => onPick(slot, e.target.value)}
                className="rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">— vali meeskond —</option>
                {candidates.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name_et} ({team.code})
                  </option>
                ))}
              </select>

              {slotResult && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-default pt-2 text-sm text-text-body">
                  <span className="font-medium text-text-primary">
                    Tegelik: {slotResult.officialTeamName}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      slotResult.points > 0
                        ? 'border-brand-green/30 bg-brand-green-soft text-brand-green'
                        : 'border-border-default bg-bg-app text-text-muted'
                    }
                  >
                    {slotResult.points > 0 ? '+' : ''}
                    {slotResult.points}p
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
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
