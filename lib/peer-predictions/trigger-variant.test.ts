import { describe, expect, it } from 'vitest';
import { classifyTriggerVariant } from './trigger-variant';

describe('classifyTriggerVariant', () => {
  it('returns singleton + hidden when m === 0', () => {
    const v = classifyTriggerVariant({ n: 0, m: 0 });
    expect(v.state).toBe('singleton');
    expect(v.hidden).toBe(true);
  });

  it('returns complete when n === m and m > 0', () => {
    const v = classifyTriggerVariant({ n: 4, m: 4 });
    expect(v.state).toBe('complete');
    expect(v.hidden).toBe(false);
    expect(v.surfaceClass).toContain('brand-green');
    expect(v.countClass).toContain('font-semibold');
  });

  it('returns empty when n === 0 and m > 0', () => {
    const v = classifyTriggerVariant({ n: 0, m: 4 });
    expect(v.state).toBe('empty');
    expect(v.hidden).toBe(false);
    expect(v.countClass).toContain('text-text-muted');
  });

  it('returns partial when 0 < n < m', () => {
    const v = classifyTriggerVariant({ n: 2, m: 4 });
    expect(v.state).toBe('partial');
    expect(v.hidden).toBe(false);
    expect(v.surfaceClass).toContain('border-default');
  });

  it('produces distinct surface classes across the three visible states', () => {
    const complete = classifyTriggerVariant({ n: 4, m: 4 }).surfaceClass;
    const partial = classifyTriggerVariant({ n: 2, m: 4 }).surfaceClass;
    const empty = classifyTriggerVariant({ n: 0, m: 4 }).surfaceClass;
    expect(complete).not.toBe(partial);
    expect(complete).not.toBe(empty);
  });
});
