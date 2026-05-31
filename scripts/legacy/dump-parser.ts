/**
 * Parses pg_dump plain-text COPY blocks from the legacy Rails 7 portal.
 *
 * Handles the subset of pg_dump output relevant to S13:
 *   - `COPY public.<table> (cols...) FROM stdin;` blocks
 *   - Tab-delimited rows
 *   - `\N` → null
 *   - `\\`, `\t`, `\n`, `\r`, `\b`, `\f`, `\v` unescape
 *   - `\.` terminator line ends the block
 *
 * Out of scope (we only need the subset): DDL, SET, ALTER, SEQUENCE, ownership,
 * GRANT/REVOKE — those lines are simply ignored.
 */

const ESCAPES: Record<string, string> = {
  '\\': '\\',
  t: '\t',
  n: '\n',
  r: '\r',
  b: '\b',
  f: '\f',
  v: '\v',
};

function unescapeField(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1]!;
      const mapped = ESCAPES[next];
      if (mapped !== undefined) {
        out += mapped;
        i++;
        continue;
      }
    }
    out += c;
  }
  return out;
}

export type CopyRow = Record<string, string | null>;

const HEADER = /^COPY\s+public\.([a-z_]+)\s*\(([^)]+)\)\s+FROM\s+stdin;$/;

/**
 * Parse a single COPY block.
 *
 * @param lines  Full file split on `\n`.
 * @param start  Index of the COPY header line.
 * @returns      Rows + the line index after the `\.` terminator.
 */
function parseBlock(
  lines: string[],
  start: number,
): { table: string; rows: CopyRow[]; next: number } | null {
  const header = lines[start];
  if (!header) return null;
  const match = HEADER.exec(header);
  if (!match) return null;

  const table = match[1]!;
  const cols = match[2]!
    .split(',')
    .map((c) => c.trim().replace(/^"|"$/g, ''));

  const rows: CopyRow[] = [];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line === '\\.') {
      return { table, rows, next: i + 1 };
    }
    const fields = line.split('\t');
    if (fields.length !== cols.length) {
      throw new Error(
        `Row ${i} of table ${table}: expected ${cols.length} fields, got ${fields.length}`,
      );
    }
    const row: CopyRow = {};
    for (let c = 0; c < cols.length; c++) {
      const f = fields[c]!;
      row[cols[c]!] = f === '\\N' ? null : unescapeField(f);
    }
    rows.push(row);
    i++;
  }
  throw new Error(`COPY block for ${table} not terminated by \\.`);
}

/**
 * Extract COPY blocks for the requested tables. Returns a map keyed by
 * table name. Tables not present in the dump are absent from the result.
 */
export function parseCopyBlocks(
  dumpText: string,
  tables: readonly string[],
): Map<string, CopyRow[]> {
  const wanted = new Set(tables);
  const lines = dumpText.split('\n');
  const result = new Map<string, CopyRow[]>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.startsWith('COPY ')) {
      const block = parseBlock(lines, i);
      if (block && wanted.has(block.table)) {
        result.set(block.table, block.rows);
      }
      i = block ? block.next : i + 1;
      continue;
    }
    i++;
  }
  return result;
}
