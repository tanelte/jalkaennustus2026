'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  createAutoSaveScheduler,
  type AutoSaveResult,
  type AutoSaveScheduler,
  type AutoSaveSnapshot,
  type AutoSaveStatus,
} from './autosave-scheduler';

export type { AutoSaveResult, AutoSaveStatus };

export interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  errorCode: string | null;
  schedule: AutoSaveScheduler['schedule'];
  flushPending: AutoSaveScheduler['flushPending'];
}

const SERVER_SNAPSHOT: AutoSaveSnapshot = {
  status: 'idle',
  lastSavedAt: null,
  errorCode: null,
};

export function useAutoSave(): UseAutoSaveReturn {
  const schedulerRef = useRef<AutoSaveScheduler | null>(null);
  if (schedulerRef.current === null) {
    schedulerRef.current = createAutoSaveScheduler();
  }
  const scheduler = schedulerRef.current;

  const snapshot = useSyncExternalStore(
    scheduler.subscribe,
    scheduler.getSnapshot,
    () => SERVER_SNAPSHOT,
  );

  useEffect(() => {
    function onHide() {
      scheduler.flushPending();
    }
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      scheduler.dispose();
    };
  }, [scheduler]);

  return {
    status: snapshot.status,
    lastSavedAt: snapshot.lastSavedAt,
    errorCode: snapshot.errorCode,
    schedule: scheduler.schedule,
    flushPending: scheduler.flushPending,
  };
}
