import { readFileSync } from 'node:fs';
import { request } from '../lib/client.js';
import { addCommonFlags, buildFilters, runHandler, } from '../lib/flags.js';
function readStdinOrValue(value) {
    if (!value)
        return undefined;
    if (value !== '-')
        return value;
    try {
        return readFileSync(0, 'utf8');
    }
    catch {
        return undefined;
    }
}
export function registerStories(program) {
    const stories = program
        .command('stories')
        .alias('story')
        .description('Manage stories');
    const list = stories
        .command('list')
        .description('List stories (GET /v1/story)')
        .option('--sentiment <s>', 'filter by primary sentiment');
    addCommonFlags(list).action(async (opts) => {
        await runHandler(async () => {
            return request('/v1/story', {
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
        .requiredOption('--headline-id <id>', 'ObjectId of the parent headline this story belongs to')
        .requiredOption('--primary-sentiment <s>', 'positive | negative | neutral')
        .requiredOption('--recap-date <iso>', 'recap date in ISO-8601 (e.g. 2026-06-24T00:00:00.000Z)')
        .option('--article-id <id>', 'existing article ObjectId to attach (repeatable, max 200)', (val, prev) => [...(prev ?? []), val], []);
    addCommonFlags(create)
        .option('--dry-run', 'print payload without sending')
        .action(async (opts) => {
        await runHandler(async () => {
            const summary = readStdinOrValue(opts.summary);
            const payload = {
                headline: opts.headline,
                summary,
                primarySentiment: opts.primarySentiment,
                recapDate: opts.recapDate,
                headlineId: opts.headlineId,
            };
            if (opts.articleIds && opts.articleIds.length > 0) {
                payload.articleIds = opts.articleIds;
            }
            if (opts.dryRun)
                return payload;
            return request('/v1/story', {
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
//# sourceMappingURL=stories.js.map