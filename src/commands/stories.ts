import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { request } from '../lib/client.js';
import {
  addCommonFlags,
  buildFilters,
  runHandler,
  type CommonFlags,
} from '../lib/flags.js';

interface StoriesListOpts extends CommonFlags {
  status?: string;
  sentiment?: string;
}

interface StoryCreateOpts extends CommonFlags {
  headline: string;
  summary: string;
  primaryTopicSlug: string;
  primaryTickerCode: string;
  primarySentiment: 'positive' | 'negative' | 'neutral';
  recapDate: string;
  articleIds?: string[];
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

export function registerStories(program: Command): void {
  const stories = program
    .command('stories')
    .alias('story')
    .description('Manage stories');

  const list = stories
    .command('list')
    .description('List stories (GET /v1/story)')
    .option('--sentiment <s>', 'filter by primary sentiment');

  addCommonFlags(list).action(async (opts: StoriesListOpts) => {
    await runHandler(async () => {
      return request<unknown>('/v1/story', {
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

  const create = stories
    .command('create')
    .description('Create a story (POST /v1/story)')
    .requiredOption('--headline <text>', 'story headline')
    .requiredOption('--summary <text>', 'story summary (use - to read from stdin)')
    .requiredOption('--primary-topic-slug <slug>', 'slug of the primary topic')
    .requiredOption('--primary-ticker-code <code>', 'primary ticker code')
    .requiredOption(
      '--primary-sentiment <s>',
      'positive | negative | neutral',
    )
    .requiredOption(
      '--recap-date <iso>',
      'recap date in ISO-8601 (e.g. 2026-06-24T00:00:00.000Z)',
    )
    .option(
      '--article-id <id>',
      'link an existing article by id (repeatable)',
      (val: string, prev: string[]) => [...(prev ?? []), val],
      [] as string[],
    );

  addCommonFlags(create)
    .option('--dry-run', 'print payload without sending')
    .action(async (opts: StoryCreateOpts) => {
      await runHandler(async () => {
        const summary = readStdinOrValue(opts.summary);
        const payload: Record<string, unknown> = {
          headline: opts.headline,
          summary,
          primaryTopicSlug: opts.primaryTopicSlug,
          primaryTickerCode: opts.primaryTickerCode,
          primarySentiment: opts.primarySentiment,
          recapDate: opts.recapDate,
        };
        if (opts.articleIds && opts.articleIds.length > 0) {
          payload.articleIds = opts.articleIds;
        }

        if (opts.dryRun) return payload;

        return request<unknown>('/v1/story', {
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