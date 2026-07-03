import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { request } from '../lib/client.js';
import {
  addCommonFlags,
  buildFilters,
  runHandler,
  type CommonFlags,
} from '../lib/flags.js';

interface HeadlineListOpts extends CommonFlags {
  sentiment?: string;
}

interface KeywordOpts {
  label: string;
  value: string;
  description?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface HeadlineCreateOpts extends CommonFlags {
  title: string;
  summary: string;
  primaryTickerCode: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  storyId?: string[];
  topicId?: string[];
  keyword?: string[];
  dryRun?: boolean;
}

interface HeadlineUpdateOpts extends CommonFlags {
  title?: string;
  summary?: string;
  primaryTickerCode?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  storyId?: string[];
  topicId?: string[];
  keyword?: string[];
  dryRun?: boolean;
}

type Sentiment = 'positive' | 'negative' | 'neutral';

function readStdinOrValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value !== '-') return value;
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Each --keyword is either a JSON object string OR a compact
 *   label=<text>,value=<text>[,description=<text>][,sentiment=<s>]
 * expression (sentiment defaults to "neutral").
 */
function parseKeyword(raw: string): KeywordOpts {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.label !== 'string' || typeof obj.value !== 'string') {
        throw new Error(
          `keyword JSON must include string "label" and "value" — got: ${raw}`,
        );
      }
      const kw: KeywordOpts = { label: obj.label, value: obj.value };
      if (typeof obj.description === 'string') kw.description = obj.description;
      if (
        typeof obj.sentiment === 'string' &&
        ['positive', 'negative', 'neutral'].includes(obj.sentiment)
      ) {
        kw.sentiment = obj.sentiment as Sentiment;
      }
      return kw;
    } catch (err) {
      throw new Error(`bad --keyword JSON: ${(err as Error).message}`);
    }
  }

  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const kv: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      throw new Error(
        `bad --keyword "${raw}" — expected key=value pairs or JSON`,
      );
    }
    kv[part.slice(0, eq)] = part.slice(eq + 1);
  }
  if (!kv.label || !kv.value) {
    throw new Error(
      `bad --keyword "${raw}" — requires at least label= and value=`,
    );
  }
  const kw: KeywordOpts = { label: kv.label, value: kv.value };
  if (kv.description) kw.description = kv.description;
  if (kv.sentiment && ['positive', 'negative', 'neutral'].includes(kv.sentiment)) {
    kw.sentiment = kv.sentiment as Sentiment;
  }
  return kw;
}

function buildKeywords(raw?: string[]): KeywordOpts[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  return raw.map(parseKeyword);
}

function buildIds(raw?: string[]): string[] | undefined {
  if (!raw || raw.length === 0) return undefined;
  return raw;
}

export function registerHeadlines(program: Command): void {
  const headlines = program
    .command('headlines')
    .alias('headline')
    .description('Manage headlines and their pivots (stories / keywords / topics)');

  // ---------- list ----------
  const list = headlines
    .command('list')
    .description('List headlines (GET /v1/headlines)')
    .option('--sentiment <s>', 'filter by sentiment');

  addCommonFlags(list).action(async (opts: HeadlineListOpts) => {
    await runHandler(async () => {
      return request<unknown>('/v1/headlines', {
        query: {
          limit: opts.limit ?? '10',
          skip: opts.skip ?? opts.offset,
        },
        filters: buildFilters(opts.filter),
        baseUrl: opts.baseUrl,
        identifier: opts.identifier,
        password: opts.password,
        basicAuth: opts.basicAuth,
      });
    }, opts);
  });

  // ---------- get ----------
  const get = headlines
    .command('get')
    .description('Get headline detail (GET /v1/headlines/{id})')
    .argument('<id>', 'headline ObjectId');

  addCommonFlags(get).action(async (id: string, opts: CommonFlags) => {
    await runHandler(async () => {
      return request<unknown>(`/v1/headlines/${encodeURIComponent(id)}`, {
        baseUrl: opts.baseUrl,
        identifier: opts.identifier,
        password: opts.password,
        basicAuth: opts.basicAuth,
      });
    }, opts);
  });

  // ---------- create ----------
  const create = headlines
    .command('create')
    .description('Create a headline (POST /v1/headlines)')
    .requiredOption('--title <text>', 'headline title (max 500 chars)')
    .requiredOption('--summary <text>', 'headline summary (use - to read from stdin)')
    .requiredOption('--primary-ticker-code <code>', 'primary ticker code, e.g. BBCA (max 20 chars)')
    .requiredOption('--sentiment <s>', 'positive | negative | neutral')
    .option(
      '--story-id <id>',
      'existing story ObjectId to associate (repeatable, max 500)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    )
    .option(
      '--topic-id <id>',
      'existing topic ObjectId to tag (repeatable, max 100)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    )
    .option(
      '--keyword <expr>',
      'keyword pivot row, JSON object or label=...,value=...,description=...,sentiment=... (repeatable)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    );

  addCommonFlags(create)
    .option('--dry-run', 'print payload without sending')
    .action(async (opts: HeadlineCreateOpts) => {
      await runHandler(async () => {
        const summary = readStdinOrValue(opts.summary);
        const payload: Record<string, unknown> = {
          title: opts.title,
          summary,
          primary_ticker_code: opts.primaryTickerCode,
          sentiment: opts.sentiment,
        };
        const storyIds = buildIds(opts.storyId);
        const topicIds = buildIds(opts.topicId);
        const keywords = buildKeywords(opts.keyword);
        if (storyIds) payload.story_ids = storyIds;
        if (topicIds) payload.topic_ids = topicIds;
        if (keywords) payload.keywords = keywords;

        if (opts.dryRun) return payload;

        return request<unknown>('/v1/headlines', {
          method: 'POST',
          body: payload,
          baseUrl: opts.baseUrl,
          identifier: opts.identifier,
          password: opts.password,
          basicAuth: opts.basicAuth,
        });
      }, opts);
    });

  // ---------- update ----------
  const update = headlines
    .command('update')
    .description('Partially update a headline (PATCH /v1/headlines/{id})')
    .argument('<id>', 'headline ObjectId')
    .option('--title <text>', 'new title')
    .option('--summary <text>', 'new summary (use - to read from stdin)')
    .option('--primary-ticker-code <code>', 'new primary ticker code')
    .option('--sentiment <s>', 'new sentiment: positive | negative | neutral')
    .option(
      '--story-id <id>',
      'REPLACES all associated stories (repeatable)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    )
    .option(
      '--topic-id <id>',
      'REPLACES all tagged topics (repeatable)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    )
    .option(
      '--keyword <expr>',
      'REPLACES all keyword pivot rows (repeatable; JSON or key=value list)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    );

  addCommonFlags(update)
    .option('--dry-run', 'print payload without sending')
    .action(async (id: string, opts: HeadlineUpdateOpts) => {
      await runHandler(async () => {
        const summary = readStdinOrValue(opts.summary);
        const payload: Record<string, unknown> = {};
        if (opts.title !== undefined) payload.title = opts.title;
        if (summary !== undefined) payload.summary = summary;
        if (opts.primaryTickerCode !== undefined) {
          payload.primary_ticker_code = opts.primaryTickerCode;
        }
        if (opts.sentiment !== undefined) payload.sentiment = opts.sentiment;

        const storyIds = buildIds(opts.storyId);
        const topicIds = buildIds(opts.topicId);
        const keywords = buildKeywords(opts.keyword);
        if (storyIds) payload.story_ids = storyIds;
        if (topicIds) payload.topic_ids = topicIds;
        if (keywords) payload.keywords = keywords;

        if (opts.dryRun) return payload;

        return request<unknown>(`/v1/headlines/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: payload,
          baseUrl: opts.baseUrl,
          identifier: opts.identifier,
          password: opts.password,
          basicAuth: opts.basicAuth,
        });
      }, opts);
    });

  // ---------- delete ----------
  const del = headlines
    .command('delete')
    .description('Delete a headline and cascade-delete its keywords (DELETE /v1/headlines/{id})')
    .argument('<id>', 'headline ObjectId');

  addCommonFlags(del).action(async (id: string, opts: CommonFlags) => {
    await runHandler(async () => {
      return request<unknown>(`/v1/headlines/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        baseUrl: opts.baseUrl,
        identifier: opts.identifier,
        password: opts.password,
        basicAuth: opts.basicAuth,
      });
    }, opts);
  });

  // ---------- stories under ----------
  const stories = headlines
    .command('stories')
    .description('List stories under a headline (GET /v1/headlines/{id}/stories)')
    .argument('<id>', 'headline ObjectId');

  addCommonFlags(stories).action(async (id: string, opts: CommonFlags) => {
    await runHandler(async () => {
      return request<unknown>(`/v1/headlines/${encodeURIComponent(id)}/stories`, {
        query: {
          limit: opts.limit ?? '10',
          skip: opts.skip ?? opts.offset,
        },
        baseUrl: opts.baseUrl,
        identifier: opts.identifier,
        password: opts.password,
        basicAuth: opts.basicAuth,
      });
    }, opts);
  });

  // ---------- keywords under ----------
  const keywords = headlines
    .command('keywords')
    .description('List keyword pivot rows for a headline (GET /v1/headlines/{id}/keywords)')
    .argument('<id>', 'headline ObjectId');

  addCommonFlags(keywords).action(async (id: string, opts: CommonFlags) => {
    await runHandler(async () => {
      return request<unknown>(`/v1/headlines/${encodeURIComponent(id)}/keywords`, {
        baseUrl: opts.baseUrl,
        identifier: opts.identifier,
        password: opts.password,
        basicAuth: opts.basicAuth,
      });
    }, opts);
  });

  // ---------- topics under ----------
  const topics = headlines
    .command('topics')
    .description('List topics tagged on a headline (GET /v1/headlines/{id}/topics)')
    .argument('<id>', 'headline ObjectId');

  addCommonFlags(topics).action(async (id: string, opts: CommonFlags) => {
    await runHandler(async () => {
      return request<unknown>(`/v1/headlines/${encodeURIComponent(id)}/topics`, {
        baseUrl: opts.baseUrl,
        identifier: opts.identifier,
        password: opts.password,
        basicAuth: opts.basicAuth,
      });
    }, opts);
  });
}
