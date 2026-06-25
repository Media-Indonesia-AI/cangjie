import { request } from '../lib/client.js';
import { addCommonFlags, buildFilters, runHandler, } from '../lib/flags.js';
export function registerTickers(program) {
    const tickers = program
        .command('tickers')
        .description('Browse stock tickers');
    addCommonFlags(tickers
        .command('list')
        .description('List stock tickers (GET /v1/stocks/stock-tickers)')
        .option('--market <market>', 'filter by market (use with --filter)')).action(async (opts) => {
        await runHandler(async () => {
            return request('/v1/stocks/stock-tickers', {
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
//# sourceMappingURL=tickers.js.map