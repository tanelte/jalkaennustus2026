type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  operation: string;
  outcome: 'ok' | 'error' | 'rejected' | 'skipped' | string;
  [key: string]: unknown;
}

function emit(level: LogLevel, fields: LogFields): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    ...fields,
  };
  // Single JSON line per call so Vercel's log drain parses it cleanly.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

export const log = {
  info: (fields: LogFields) => emit('info', fields),
  warn: (fields: LogFields) => emit('warn', fields),
  error: (fields: LogFields) => emit('error', fields),
};
