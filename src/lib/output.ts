import chalk from 'chalk';

export interface RenderOptions {
  json?: boolean;
  csv?: boolean;
  compact?: boolean;
  select?: string[];
  quiet?: boolean;
  noColor?: boolean;
}

const HIGH_GRAVITY_KEYS = [
  'id',
  'slug',
  'name',
  'headline',
  'title',
  'status',
  'symbol',
  'notation',
  'ticker',
  'primary_topic_slug',
  'primary_ticker_code',
  'primary_sentiment',
  'recap_date',
  'article_count',
  'source_count',
  'created_at',
  'updated_at',
  'published_at',
];

function useColor(noColor?: boolean): boolean {
  if (noColor || process.env.NO_COLOR) return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

function isPiped(): boolean {
  return !process.stdout.isTTY;
}

export function wantsJson(opts: RenderOptions): boolean {
  if (opts.json) return true;
  if (isPiped() && !opts.csv && !opts.quiet) return true;
  return false;
}

function compactRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of HIGH_GRAVITY_KEYS) {
    if (k in rec) out[k] = rec[k];
  }
  return out;
}

function projectSelect(
  rec: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in rec) out[k] = rec[k];
  }
  return out;
}

function applyShape(
  rec: Record<string, unknown>,
  opts: RenderOptions,
): Record<string, unknown> {
  let shaped = rec;
  if (opts.select && opts.select.length) shaped = projectSelect(shaped, opts.select);
  else if (opts.compact) shaped = compactRecord(shaped);
  return shaped;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(',')];
  for (const r of rows) lines.push(keys.map((k) => esc(r[k])).join(','));
  return lines.join('\n');
}

function renderTable(
  rows: Record<string, unknown>[],
  opts: RenderOptions,
): string {
  if (rows.length === 0) {
    return useColor(opts.noColor) ? chalk.yellow('No results.') : 'No results.';
  }
  const color = useColor(opts.noColor);
  const keys = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );

  const widths = keys.map((k) =>
    Math.max(
      k.length,
      ...rows.map((r) => {
        const v = r[k];
        const s =
          v === null || v === undefined
            ? ''
            : typeof v === 'object'
              ? JSON.stringify(v)
              : String(v);
        return s.length;
      }),
    ),
  );

  const fmtCell = (val: unknown, key: string): string => {
    if (val === null || val === undefined) return color ? chalk.dim('-') : '-';
    const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (!color) return s;
    if (key === 'id') return chalk.cyan(s);
    if (key === 'status') return chalk.green(s);
    if (key === 'symbol' || key === 'notation' || key === 'ticker')
      return chalk.yellow(s);
    return s;
  };

  const header = keys
    .map((k, i) => (color ? chalk.bold.underline(k.padEnd(widths[i])) : k.padEnd(widths[i])))
    .join('  ');
  const sep = color
    ? chalk.dim(keys.map((k, i) => '-'.repeat(widths[i])).join('  '))
    : keys.map((k, i) => '-'.repeat(widths[i])).join('  ');
  const body = rows.map((r) =>
    keys.map((k, i) => fmtCell(r[k], k).padEnd(widths[i])).join('  '),
  );

  return [header, sep, ...body].join('\n');
}

export function render(data: unknown, opts: RenderOptions = {}): string {
  const rows = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : data && typeof data === 'object'
      ? [data as Record<string, unknown>]
      : [{ value: data }];

  if (opts.quiet) {
    return rows
      .map((r) => {
        const id = r.id ?? r.uuid;
        return id !== undefined ? String(id) : JSON.stringify(r);
      })
      .join('\n');
  }

  if (wantsJson(opts)) {
    const shaped = rows.map((r) => applyShape(r, opts));
    return JSON.stringify(
      shaped.length === 1 && !Array.isArray(data) ? shaped[0] : shaped,
      null,
      2,
    );
  }

  if (opts.csv) {
    const shaped = rows.map((r) => applyShape(r, opts));
    return toCsv(shaped);
  }

  const shaped = rows.map((r) => applyShape(r, opts));
  return renderTable(shaped, opts);
}

export function info(message: string, opts: { noColor?: boolean } = {}): void {
  const prefix = useColor(opts.noColor) ? chalk.blue('ℹ ') : 'ℹ ';
  process.stderr.write(prefix + message + '\n');
}

export function warn(message: string, opts: { noColor?: boolean } = {}): void {
  const prefix = useColor(opts.noColor) ? chalk.yellow('⚠ ') : '⚠ ';
  process.stderr.write(prefix + message + '\n');
}

export function error(message: string, opts: { noColor?: boolean } = {}): void {
  const prefix = useColor(opts.noColor) ? chalk.red('✗ ') : '✗ ';
  process.stderr.write(prefix + message + '\n');
}