import { Command } from 'commander';
import { request } from '../lib/client.js';
import {
  addCommonFlags,
  buildFilters,
  runHandler,
  type CommonFlags,
} from '../lib/flags.js';

interface ArticlesOpts extends CommonFlags {
  status?: string;
  source?: string;
}

export function registerArticles(program: Command): void {
  const articles = program
    .command('articles')
    .alias('article')
    .description('Browse articles');

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
}