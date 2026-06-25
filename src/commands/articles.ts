import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { request } from '../lib/client.js';
import {
  addCommonFlags,
  buildFilters,
  runHandler,
  type CommonFlags,
} from '../lib/flags.js';

interface ArticlesOpts extends CommonFlags {
  source?: string;
}

interface ArticleCreateOpts extends CommonFlags {
  title: string;
  source: string;
  publishedAt: string;
  content: string;
  topicSlug?: string[];
  dryRun?: boolean;
}

function readStdinOrValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value !== '-') return value;
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return undefined;
  }
}

export function registerArticles(program: Command): void {
  const articles = program
    .command('articles')
    .alias('article')
    .description('Browse and create articles');

  addCommonFlags(
    articles
      .command('list')
      .description('List articles (GET /v1/article)')
      .option('--source <source>', 'filter by source (use with --filter)'),
  ).action(async (opts: ArticlesOpts) => {
    await runHandler(async () => {
      return request<unknown>('/v1/article', {
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

  const create = articles
    .command('create')
    .description('Create an article (POST /v1/article)')
    .requiredOption('--title <text>', 'article title (max 500 chars)')
    .requiredOption('--source <name>', 'article source, e.g. kontan.co.id (max 200 chars)')
    .requiredOption(
      '--published-at <iso>',
      'publish date in ISO-8601 (e.g. 2026-06-22T15:30:00.000Z)',
    )
    .requiredOption('--content <text>', 'article body (use - to read from stdin)')
    .option(
      '--topic-slug <slug>',
      'link to an existing topic by slug (repeatable, max 10)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    );

  addCommonFlags(create)
    .option('--dry-run', 'print payload without sending')
    .action(async (opts: ArticleCreateOpts) => {
      await runHandler(async () => {
        const content = readStdinOrValue(opts.content);
        const payload: Record<string, unknown> = {
          title: opts.title,
          source: opts.source,
          publishedAt: opts.publishedAt,
          content,
        };
        if (opts.topicSlug && opts.topicSlug.length > 0) {
          payload.topicSlugs = opts.topicSlug;
        }

        if (opts.dryRun) return payload;

        return request<unknown>('/v1/article', {
          method: 'POST',
          body: payload,
          baseUrl: opts.baseUrl,
          identifier: opts.identifier,
          password: opts.password,
          basicAuth: opts.basicAuth,
        });
      }, opts);
    });
}