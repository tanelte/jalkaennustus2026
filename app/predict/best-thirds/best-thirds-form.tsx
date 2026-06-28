'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { EditUnlockBanner } from '@/components/pin/edit-unlock-banner';
import { PinEntryModal } from '@/components/pin/pin-entry-modal';
import { SaveStatusIndicator } from '@/components/save-status-indicator';
import { useAutoSave } from '@/lib/hooks/use-autosave';
import type { EditMode } from '@/lib/pin/edit-mode';
import { toggleBestThirdsLetter } from './actions';
import { GROUP_LETTERS, REQUIRED_PICKS } from './constants';
import {
  buildBestThirdsResultView,
  type BestThirdsLetterStatus,
} from './result-view';

const ERROR_COPY: Record<string, string> = {
  invalid_letter: 'Üks valitud tähtedest ei kuulu gruppide A–L hulka.',
  stage_closed: 'Best-thirds ennustuse aken on suletud.',
  stage_not_yet: 'Best-thirds ennustuse aken ei ole veel avatud.',
  stage_not_found: 'Best-thirds etappi ei leitud — võta ühendust korraldajaga.',
  no_user: 'Vali kõigepealt kasutaja.',
  no_session: 'Logi sisse uuesti.',
  pin_required:
    'PIN-i sessioon aegus. Värskenda lehte ja klõpsa Muuda nuppu uuesti.',
  pin_rate_limited:
    'Liiga palju vale PIN-i katseid. Proovi mõne minuti pärast (või kasuta "Unustasid PIN-i?").',
  network_error: 'Võrguviga — proovi uuesti.',
};

export interface BestThirdsFormProps {
  initialPicks: readonly string[];
  /**
   * The official best-thirds letters owned by the `tegelikud tulemused`
   * singleton. Non-empty ⇒ results are in and the surface renders read-only
   * outcomes (correct / wrong / missed) plus the points earned.
   */
  officialLetters?: readonly string[] | null;
  mode: EditMode;
  userId: string;
  maskedRecoveryEmail?: string | null;
}

// Tile styling per post-results status. Greens reuse the picked-tile palette;
// `missed` is an unfilled green outline (a right answer the user did not pick).
const STATUS_TILE_CLASSES: Record<BestThirdsLetterStatus, string> = {
  correct: 'border-brand-green bg-brand-green text-white shadow-sm',
  wrong: 'border-border-default bg-bg-app text-text-muted',
  missed: 'border-brand-green border-dashed bg-brand-green-soft text-brand-green',
  neutral: 'border-border-default bg-surface-card text-text-muted',
};

const STATUS_LABELS: Record<BestThirdsLetterStatus, string> = {
  correct: 'õige valik',
  wrong: 'vale valik',
  missed: 'õige täht, jäi valimata',
  neutral: 'ei valitud',
};

export function BestThirdsForm({
  initialPicks,
  officialLetters,
  mode,
  userId,
  maskedRecoveryEmail,
}: BestThirdsFormProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialPicks));
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const autosave = useAutoSave();

  const disabled = mode !== 'edit';

  function toggle(letter: string) {
    if (disabled) return;
    const wasSelected = selected.has(letter);
    // The UI cap is informational: prevent the user from over-picking past 8.
    // The server itself accepts partial selections.
    if (!wasSelected && selected.size >= REQUIRED_PICKS) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (wasSelected) next.delete(letter);
      else next.add(letter);
      return next;
    });
    autosave.schedule(`letter:${letter}`, () =>
      toggleBestThirdsLetter(letter, !wasSelected),
    );
  }

  const count = selected.size;
  const errorMessage = autosave.errorCode
    ? ERROR_COPY[autosave.errorCode] ?? null
    : null;

  // Results are in once the official set is non-empty. Editing is closed by
  // then, so `selected` equals the persisted picks. Per-letter outcomes and the
  // total are derived live from the official set (no trust in stale points).
  const resultView =
    officialLetters && officialLetters.length > 0
      ? buildBestThirdsResultView([...selected], officialLetters)
      : null;
  const statusByLetter = resultView
    ? new Map(resultView.letters.map((l) => [l.letter, l]))
    : null;

  return (
    <div className="space-y-5">
      {mode === 'pending-unlock' && (
        <EditUnlockBanner onUnlockClick={() => setPinModalOpen(true)} />
      )}

      <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2 shadow-[0_4px_8px_-6px_rgba(0,0,0,0.12)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {resultView ? (
          <p className="text-sm text-text-muted" aria-live="polite">
            Punktid:{' '}
            <strong className="text-text-primary">{resultView.totalPoints}</strong>{' '}
            / {resultView.maxPoints}
            <span className="ml-2 text-text-muted">
              ({resultView.correctCount} / {REQUIRED_PICKS} õiget)
            </span>
          </p>
        ) : (
          <p className="text-sm text-text-muted" aria-live="polite">
            Valitud:{' '}
            <strong className="text-text-primary">{count}</strong> / {REQUIRED_PICKS}
          </p>
        )}
        {!resultView && (
          <SaveStatusIndicator
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
            errorMessage={errorMessage}
          />
        )}
      </div>

      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        role="group"
        aria-label="Grupid"
      >
        {GROUP_LETTERS.map((letter) => {
          const checked = selected.has(letter);
          const cell = statusByLetter?.get(letter) ?? null;

          // Results-in: read-only tile styled by outcome (correct/wrong/missed).
          if (cell) {
            return (
              <div
                key={letter}
                className={`relative flex h-16 items-center justify-center rounded-lg border text-xl font-semibold ${STATUS_TILE_CLASSES[cell.status]}`}
                aria-label={`Grupp ${letter}: ${STATUS_LABELS[cell.status]}${
                  cell.picked ? `, ${cell.points} punkti` : ''
                }`}
              >
                <span>{letter}</span>
                {cell.status === 'correct' && (
                  <Check
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 h-3.5 w-3.5"
                  />
                )}
                {cell.picked && (
                  <span
                    className={`absolute bottom-1 right-1.5 text-[10px] font-semibold leading-none tabular-nums ${
                      cell.status === 'correct' ? 'text-white/90' : 'text-text-muted'
                    }`}
                  >
                    {cell.points > 0 ? '+' : ''}
                    {cell.points}p
                  </span>
                )}
              </div>
            );
          }

          return (
            <label
              key={letter}
              className={`relative flex h-16 cursor-pointer items-center justify-center rounded-lg border text-xl font-semibold transition-colors ${
                checked
                  ? 'border-brand-green bg-brand-green text-white shadow-sm'
                  : 'border-border-default bg-surface-card text-text-primary hover:border-brand-green/40'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                name="letters"
                value={letter}
                checked={checked}
                onChange={() => toggle(letter)}
                disabled={disabled}
                className="sr-only"
              />
              <span>{letter}</span>
              {checked && (
                <Check
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5"
                />
              )}
            </label>
          );
        })}
      </div>

      {resultView && (
        <div className="space-y-2 border-t border-border-default pt-3 text-sm">
          <p className="text-text-body">
            <span className="text-text-muted">Õiged tähed: </span>
            <strong className="text-text-primary tabular-nums">
              {resultView.officialLetters.length > 0
                ? resultView.officialLetters.join(', ')
                : '—'}
            </strong>
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-green align-middle" />
              õige valik
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-brand-green bg-brand-green-soft align-middle" />
              õige täht, jäi valimata
            </span>
          </p>
        </div>
      )}

      {mode === 'closed' && !resultView && (
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
