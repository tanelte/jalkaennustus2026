import { describe, expect, it } from 'vitest';
import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('masks the middle of a typical local part, keeping first and last chars', () => {
    expect(maskEmail('alex@gmail.com')).toBe('a***x@gmail.com');
  });

  it('keeps the full domain (with subdomain)', () => {
    expect(maskEmail('john.doe@mail.example.org')).toBe('j***e@mail.example.org');
  });

  it('returns ** + @domain for a 2-character local part', () => {
    expect(maskEmail('ab@gmail.com')).toBe('**@gmail.com');
  });

  it('returns * + @domain for a 1-character local part', () => {
    expect(maskEmail('x@gmail.com')).toBe('*@gmail.com');
  });

  it('returns "***" for input with no @', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('returns "***" for input with no domain dot', () => {
    expect(maskEmail('alex@localhost')).toBe('***');
  });

  it('returns "***" when @ is leading or trailing', () => {
    expect(maskEmail('@gmail.com')).toBe('***');
    expect(maskEmail('alex@')).toBe('***');
  });

  it('returns "***" for empty string', () => {
    expect(maskEmail('')).toBe('***');
  });
});
