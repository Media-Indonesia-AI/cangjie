import { Command } from 'commander';
import { request } from '../lib/client.js';
import {
  addCommonFlags,
  buildFilters,
  runHandler,
  type CommonFlags,
} from '../lib/flags.js';

export function registerTopics(program: Command): void {
  const topics = program
    .command('topics')
    .alias('topic')
    .description('Browse topics');

  addCommonFlags(
    topics
      .command('list')
      .description('List topics (GET /v1/topic)'),
  ).action(async (opts: CommonFlags) => {
    await runHandler(async () => {
      return request<unknown>('/v1/topic', {
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