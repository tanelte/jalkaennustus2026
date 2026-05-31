import { describe, it, expect } from 'vitest';
import { parseCopyBlocks } from '../dump-parser';

describe('parseCopyBlocks', () => {
  it('extracts a single table with tab-delimited rows', () => {
    const dump = [
      'COPY public.users (id, name, created_at, updated_at) FROM stdin;',
      '1\tMart\t2012-06-05 07:51:45\t2012-07-01 20:19:30',
      '2\tArmo\t2012-06-06 06:59:03\t2012-07-01 20:19:30',
      '\\.',
      '',
    ].join('\n');

    const result = parseCopyBlocks(dump, ['users']);
    const rows = result.get('users');
    expect(rows).toHaveLength(2);
    expect(rows![0]).toEqual({
      id: '1',
      name: 'Mart',
      created_at: '2012-06-05 07:51:45',
      updated_at: '2012-07-01 20:19:30',
    });
  });

  it('maps \\N to null', () => {
    const dump = [
      'COPY public.user_results (id, points) FROM stdin;',
      '1\t100',
      '2\t\\N',
      '\\.',
    ].join('\n');

    const rows = parseCopyBlocks(dump, ['user_results']).get('user_results');
    expect(rows![0]!.points).toBe('100');
    expect(rows![1]!.points).toBeNull();
  });

  it('unescapes \\\\ \\t \\n inside fields', () => {
    const dump = [
      'COPY public.t (id, body) FROM stdin;',
      '1\tline1\\nline2',
      '2\twith\\ttab',
      '3\twith\\\\backslash',
      '\\.',
    ].join('\n');

    const rows = parseCopyBlocks(dump, ['t']).get('t');
    expect(rows![0]!.body).toBe('line1\nline2');
    expect(rows![1]!.body).toBe('with\ttab');
    expect(rows![2]!.body).toBe('with\\backslash');
  });

  it('skips tables that were not requested', () => {
    const dump = [
      'COPY public.a (id) FROM stdin;',
      '1',
      '\\.',
      'COPY public.b (id) FROM stdin;',
      '2',
      '\\.',
    ].join('\n');

    const result = parseCopyBlocks(dump, ['b']);
    expect(result.has('a')).toBe(false);
    expect(result.get('b')).toEqual([{ id: '2' }]);
  });

  it('throws on unterminated COPY block', () => {
    const dump = [
      'COPY public.t (id) FROM stdin;',
      '1',
      '2',
    ].join('\n');

    expect(() => parseCopyBlocks(dump, ['t'])).toThrow(/not terminated/);
  });

  it('throws on mismatched column count', () => {
    const dump = [
      'COPY public.t (id, name) FROM stdin;',
      '1\tArmo\textra',
      '\\.',
    ].join('\n');

    expect(() => parseCopyBlocks(dump, ['t'])).toThrow(/expected 2 fields, got 3/);
  });

  it('ignores SET/ALTER/comment lines outside blocks', () => {
    const dump = [
      '--',
      '-- header comment',
      'SET search_path = public;',
      'ALTER TABLE foo OWNER TO bar;',
      'COPY public.t (id) FROM stdin;',
      '42',
      '\\.',
      '',
    ].join('\n');

    const rows = parseCopyBlocks(dump, ['t']).get('t');
    expect(rows).toEqual([{ id: '42' }]);
  });
});
