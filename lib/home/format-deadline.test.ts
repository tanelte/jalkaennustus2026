import { describe, expect, it } from 'vitest';
import { formatDeadlineAbsolute, formatDeadlineRelative } from './format-deadline';

describe('formatDeadlineAbsolute', () => {
  it('formats in Estonian short date/time in Tallinn timezone', () => {
    const out = formatDeadlineAbsolute(new Date('2026-06-11T13:00:00Z'));
    expect(out).toMatch(/11/);
    expect(out).toMatch(/06|jun/i);
    expect(out).toMatch(/16/); // 13:00Z = 16:00 Tallinn (EEST)
  });
});

describe('formatDeadlineRelative', () => {
  const now = new Date('2026-06-10T12:00:00Z');

  it('returns null when closesAt is in the past', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T11:59:59Z'), now)).toBeNull();
  });

  it('returns "kohe sulgumas" when less than a minute remains', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T12:00:30Z'), now)).toBe(
      'kohe sulgumas',
    );
  });

  it('returns minutes-only when under one hour', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T12:30:00Z'), now)).toBe(
      '30 minutit',
    );
  });

  it('uses singular minut for exactly one minute', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T12:01:00Z'), now)).toBe(
      '1 minut',
    );
  });

  it('returns hours + minutes when under one day', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T15:30:00Z'), now)).toBe(
      '3 tundi 30 minutit',
    );
  });

  it('returns hours-only when minutes are zero', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T15:00:00Z'), now)).toBe(
      '3 tundi',
    );
  });

  it('returns singular tund for exactly one hour', () => {
    expect(formatDeadlineRelative(new Date('2026-06-10T13:00:00Z'), now)).toBe('1 tund');
  });

  it('returns days + hours when over a day', () => {
    expect(formatDeadlineRelative(new Date('2026-06-15T15:00:00Z'), now)).toBe(
      '5 päeva 3 tundi',
    );
  });

  it('returns days-only when hours are zero', () => {
    expect(formatDeadlineRelative(new Date('2026-06-15T12:00:00Z'), now)).toBe('5 päeva');
  });

  it('returns singular päev for exactly one day', () => {
    expect(formatDeadlineRelative(new Date('2026-06-11T12:00:00Z'), now)).toBe('1 päev');
  });
});
