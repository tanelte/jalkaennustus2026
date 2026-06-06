import { describe, expect, it } from 'vitest';
import { isValidPin, isValidEmail } from './validate';

describe('isValidPin', () => {
  it('accepts exactly four ASCII digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
    expect(isValidPin('9999')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin(' 1234')).toBe(false);
    expect(isValidPin('1234 ')).toBe(false);
    expect(isValidPin('12.4')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidPin(1234)).toBe(false);
    expect(isValidPin(null)).toBe(false);
    expect(isValidPin(undefined)).toBe(false);
    expect(isValidPin({})).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('alex@gmail.com')).toBe(true);
    expect(isValidEmail('john.doe@mail.example.org')).toBe(true);
    expect(isValidEmail('a+b@c.io')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(isValidEmail('alexgmail.com')).toBe(false);
  });

  it('rejects missing domain dot', () => {
    expect(isValidEmail('alex@localhost')).toBe(false);
  });

  it('rejects whitespace', () => {
    expect(isValidEmail('alex @gmail.com')).toBe(false);
    expect(isValidEmail('alex@gmail.com ')).toBe(false);
    expect(isValidEmail(' alex@gmail.com')).toBe(false);
  });

  it('rejects empty / non-string input', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });
});
