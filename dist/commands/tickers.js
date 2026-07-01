import { request } from '../lib/client.js';
import { addCommonFlags, buildFilters, runHandler, } from '../lib/flags.js';
// The stock-tickers endpoint has no documented max page size and the user
// wants the full ticker universe in a single response so agents never have to
// follow a "next page" cursor. We pin `limit=10000` and ignore any
// --limit the caller passes — pagination on this endpoint is deliberately
// turned off.
const TICKER_FETCH_LIMIT = '10000';
export function registerTickers(program) {
    const tickers = program
        .command('tickers')
        .description('Browse stock tickers');
    addCommonFlags(tickers
        .command('list')
        .description(`List stock tickers (GET /v1/stocks/stock-tickers) — fixed limit=${TICKER_FETCH_LIMIT}, no pagination`)
        .option('--market <market>', 'filter by market (use with --filter)')).action(async (opts) => {
        await runHandler(async () => {
            return request('/v1/stocks/stock-tickers', {
                query: {
                    // Pinned — do not let callers shrink this and trigger a paginated
                    // response. Any tickers beyond TICKER_FETCH_LIMIT are the API's
                    // problem to surface; the agent's contract is "single call, full set".
                    limit: TICKER_FETCH_LIMIT,
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