import { request } from '../lib/client.js';
import { addCommonFlags, buildFilters, runHandler, } from '../lib/flags.js';
export function registerTopics(program) {
    const topics = program
        .command('topics')
        .alias('topic')
        .description('Browse topics');
    addCommonFlags(topics
        .command('list')
        .description('List topics (GET /v1/topic)')).action(async (opts) => {
        await runHandler(async () => {
            return request('/v1/topic', {
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
//# sourceMappingURL=topics.js.map