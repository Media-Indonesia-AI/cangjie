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
/**
 * Each --keyword is either a JSON object string OR a compact
 *   label=<text>,value=<text>[,description=<text>][,sentiment=<s>]
 * expression (sentiment defaults to "neutral").
 */
function parseKeyword(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        try {
            const obj = JSON.parse(trimmed);
            if (typeof obj.label !== 'string' || typeof obj.value !== 'string') {
                throw new Error(`keyword JSON must include string "label" and "value" — got: ${raw}`);
            }
            const kw = { label: obj.label, value: obj.value };
            if (typeof obj.description === 'string')
                kw.description = obj.description;
            if (typeof obj.sentiment === 'string' &&
                ['positive', 'negative', 'neutral'].includes(obj.sentiment)) {
                kw.sentiment = obj.sentiment;
            }
            return kw;
        }
        catch (err) {
            throw new Error(`bad --keyword JSON: ${err.message}`);
        }
    }
    const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
    const kv = {};
    for (const part of parts) {
        const eq = part.indexOf('=');
        if (eq === -1) {
            throw new Error(`bad --keyword "${raw}" — expected key=value pairs or JSON`);
        }
        kv[part.slice(0, eq)] = part.slice(eq + 1);
    }
    if (!kv.label || !kv.value) {
        throw new Error(`bad --keyword "${raw}" — requires at least label= and value=`);
    }
    const kw = { label: kv.label, value: kv.value };
    if (kv.description)
        kw.description = kv.description;
    if (kv.sentiment && ['positive', 'negative', 'neutral'].includes(kv.sentiment)) {
        kw.sentiment = kv.sentiment;
    }
    return kw;
}
function buildKeywords(raw) {
    if (!raw || raw.length === 0)
        return undefined;
    return raw.map(parseKeyword);
}
function buildIds(raw) {
    if (!raw || raw.length === 0)
        return undefined;
    return raw;
}
export function registerHeadlines(program) {
    const headlines = program
        .command('headlines')
        .alias('headline')
        .description('Manage headlines and their pivots (stories / keywords / topics)');
    // ---------- list ----------
    const list = headlines
        .command('list')
        .description('List headlines (GET /v1/headlines)')
        .option('--sentiment <s>', 'filter by sentiment');
    addCommonFlags(list).action(async (opts) => {
        await runHandler(async () => {
            return request('/v1/headlines', {
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
    addCommonFlags(get).action(async (id, opts) => {
        await runHandler(async () => {
            return request(`/v1/headlines/${encodeURIComponent(id)}`, {
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
        .option('--story-id <id>', 'existing story ObjectId to associate (repeatable, max 500)', (val, prev) => [...(prev ?? []), val], [])
        .option('--topic-id <id>', 'existing topic ObjectId to tag (repeatable, max 100)', (val, prev) => [...(prev ?? []), val], [])
        .option('--keyword <expr>', 'keyword pivot row, JSON object or label=...,value=...,description=...,sentiment=... (repeatable)', (val, prev) => [...(prev ?? []), val], []);
    addCommonFlags(create)
        .option('--dry-run', 'print payload without sending')
        .action(async (opts) => {
        await runHandler(async () => {
            const summary = readStdinOrValue(opts.summary);
            const payload = {
                title: opts.title,
                summary,
                primary_ticker_code: opts.primaryTickerCode,
                sentiment: opts.sentiment,
            };
            const storyIds = buildIds(opts.storyId);
            const topicIds = buildIds(opts.topicId);
            const keywords = buildKeywords(opts.keyword);
            if (storyIds)
                payload.story_ids = storyIds;
            if (topicIds)
                payload.topic_ids = topicIds;
            if (keywords)
                payload.keywords = keywords;
            if (opts.dryRun)
                return payload;
            return request('/v1/headlines', {
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
        .option('--story-id <id>', 'REPLACES all associated stories (repeatable)', (val, prev) => [...(prev ?? []), val], [])
        .option('--topic-id <id>', 'REPLACES all tagged topics (repeatable)', (val, prev) => [...(prev ?? []), val], [])
        .option('--keyword <expr>', 'REPLACES all keyword pivot rows (repeatable; JSON or key=value list)', (val, prev) => [...(prev ?? []), val], []);
    addCommonFlags(update)
        .option('--dry-run', 'print payload without sending')
        .action(async (id, opts) => {
        await runHandler(async () => {
            const summary = readStdinOrValue(opts.summary);
            const payload = {};
            if (opts.title !== undefined)
                payload.title = opts.title;
            if (summary !== undefined)
                payload.summary = summary;
            if (opts.primaryTickerCode !== undefined) {
                payload.primary_ticker_code = opts.primaryTickerCode;
            }
            if (opts.sentiment !== undefined)
                payload.sentiment = opts.sentiment;
            const storyIds = buildIds(opts.storyId);
            const topicIds = buildIds(opts.topicId);
            const keywords = buildKeywords(opts.keyword);
            if (storyIds)
                payload.story_ids = storyIds;
            if (topicIds)
                payload.topic_ids = topicIds;
            if (keywords)
                payload.keywords = keywords;
            if (opts.dryRun)
                return payload;
            return request(`/v1/headlines/${encodeURIComponent(id)}`, {
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
    addCommonFlags(del).action(async (id, opts) => {
        await runHandler(async () => {
            return request(`/v1/headlines/${encodeURIComponent(id)}`, {
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
    addCommonFlags(stories).action(async (id, opts) => {
        await runHandler(async () => {
            return request(`/v1/headlines/${encodeURIComponent(id)}/stories`, {
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
    addCommonFlags(keywords).action(async (id, opts) => {
        await runHandler(async () => {
            return request(`/v1/headlines/${encodeURIComponent(id)}/keywords`, {
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
    addCommonFlags(topics).action(async (id, opts) => {
        await runHandler(async () => {
            return request(`/v1/headlines/${encodeURIComponent(id)}/topics`, {
                baseUrl: opts.baseUrl,
                identifier: opts.identifier,
                password: opts.password,
                basicAuth: opts.basicAuth,
            });
        }, opts);
    });
}
//# sourceMappingURL=headlines.js.map