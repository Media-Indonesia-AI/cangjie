import type { Command } from 'commander';
import { render, error as printError, type RenderOptions } from './output.js';
import { ApiError, ExitCode, type Filter } from './client.js';

export interface CommonFlags extends RenderOptions {
  limit?: string;
  skip?: string;
  page?: string;
  offset?: string;
  baseUrl?: string;
  identifier?: string;
  password?: string;
  basicAuth?: string;
  filter?: string[];
  color?: boolean;
}

export function addCommonFlags(cmd: Command): Command {
  return cmd
    .option('--limit <n>', 'max items (1-100, default 10)')
    .option('--skip <n>', 'items to skip (pagination offset)')
    .option('--offset <n>', 'alias for --skip (used by some endpoints)')
    .option('--filter <expr>', 'add a filter: field=value or field=op:value (repeatable)')
    .option('--base-url <url>', 'override API base URL')
    .option('--identifier <id>', 'identifier (email or username) for Basic auth')
    .option('--password <pw>', 'password for Basic auth')
    .option('--basic-auth <cred>', 'pre-encoded "identifier:password" string')
    .option('--json', 'output as JSON')
    .option('--csv', 'output as CSV')
    .option('--compact', 'output only high-gravity fields')
    .option('--select <keys...>', 'project specific fields')
    .option('--quiet', 'output ids only')
    .option('--no-color', 'disable color');
}

export function pickRenderFlags(opts: CommonFlags): RenderOptions {
  return {
    json: opts.json,
    csv: opts.csv,
    compact: opts.compact,
    select: opts.select,
    quiet: opts.quiet,
    noColor: opts.color === false,
  };
}

export function parseFilter(expr: string): Filter {
  // Supports: field=value  OR  field=op:value
  const eqIdx = expr.indexOf('=');
  if (eqIdx === -1) {
    throw new Error(
      `bad --filter "${expr}" — expected field=value or field=op:value`,
    );
  }
  const field = expr.slice(0, eqIdx);
  const rest = expr.slice(eqIdx + 1);
  const opMatch = rest.match(/^([a-z]+):(.*)$/);
  const operator = opMatch ? opMatch[1] : 'eq';
  const rawValue = opMatch ? opMatch[2] : rest;
  let value: unknown = rawValue;
  if (typeof rawValue === 'string') {
    if (/^(true|false)$/i.test(rawValue)) value = rawValue.toLowerCase() === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(rawValue)) value = Number(rawValue);
  }
  return { field, operator: operator as Filter['operator'], value };
}

export function buildFilters(raw?: string[]): Filter[] {
  if (!raw || raw.length === 0) return [];
  return raw.map(parseFilter);
}

export function unwrap(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'items', 'results', 'records']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [data];
}

export async function runHandler(
  fn: () => Promise<unknown>,
  flags: CommonFlags,
): Promise<void> {
  try {
    const data = await fn();
    process.stdout.write(render(unwrap(data), pickRenderFlags(flags)) + '\n');
  } catch (err) {
    handleError(err as Error, flags);
  }
}

export function handleError(err: Error, flags: CommonFlags): never {
  const noColor = flags.color === false;
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      printError(`auth failed: ${err.message}`, { noColor });
      process.exit(ExitCode.Auth);
    }
    if (err.status === 404) {
      printError(`not found: ${err.message}`, { noColor });
      process.exit(ExitCode.NotFound);
    }
    if (err.status === 429) {
      printError(`rate limited: ${err.message}`, { noColor });
      process.exit(ExitCode.RateLimited);
    }
    printError(`api error (${err.status}): ${err.message}`, { noColor });
    process.exit(ExitCode.Api);
  }
  printError(err.message, { noColor });
  process.exit(ExitCode.Usage);
}