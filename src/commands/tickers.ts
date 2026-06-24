import { Command } from 'commander';
import { request } from '../lib/client.js';
import {
  addCommonFlags,
  buildFilters,
  runHandler,
  type CommonFlags,
} from '../lib/flags.js';

interface TickersOpts extends CommonFlags {
  market?: string;
}

export function registerTickers(program: Command): void {
  const tickers = program
    .command('tickers')
    .description('Browse stock tickers');

  addCommonFlags(
    tickers
      .command('list')
      .description('List stock tickers (GET /v1/stocks/stock-tickers)')
      .option('--market <market>', 'filter by market (use with --filter)'),
  ).action(async (opts: TickersOpts) => {
    await runHandler(async () => {
      return request<unknown>('/v1/stocks/stock-tickers', {
        query: {
          limit: opts.limit ?? '10',
          offset: opts.offset ?? opts.skip,
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