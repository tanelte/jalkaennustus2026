import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from './log';

describe('log', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // eslint-disable-next-line no-console
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it('emits one JSON line with operation and outcome', () => {
    log.info({ operation: 'unit_test', outcome: 'ok' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.operation).toBe('unit_test');
    expect(line.outcome).toBe('ok');
    expect(line.level).toBe('info');
    expect(typeof line.ts).toBe('string');
  });

  it('preserves additional fields', () => {
    log.warn({ operation: 'unit_test', outcome: 'rejected', match_id: 'abc' });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.match_id).toBe('abc');
    expect(line.level).toBe('warn');
  });
});
