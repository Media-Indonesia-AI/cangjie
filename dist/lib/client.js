import { resolveBaseUrl, resolveBasicAuth } from './config.js';
// Typed exit codes — mirror printingpress-cli conventions.
export const ExitCode = {
    Success: 0,
    Usage: 2,
    NotFound: 3,
    Auth: 4,
    Api: 5,
    RateLimited: 7,
};
export class ApiError extends Error {
    status;
    body;
    constructor(status, message, body) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}
function buildUrl(base, path, query, filters) {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, base.endsWith('/') ? base : `${base}/`);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null)
                continue;
            if (Array.isArray(v)) {
                for (const item of v)
                    url.searchParams.append(k, String(item));
            }
            else {
                url.searchParams.set(k, String(v));
            }
        }
    }
    if (filters && filters.length) {
        filters.forEach((f, i) => {
            url.searchParams.append(`filters[${i}][field]`, f.field);
            url.searchParams.append(`filters[${i}][operator]`, f.operator ?? 'eq');
            url.searchParams.append(`filters[${i}][value]`, typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value));
        });
    }
    return url.toString();
}
export async function request(path, opts = {}) {
    const baseUrl = resolveBaseUrl(opts.baseUrl);
    const creds = resolveBasicAuth(opts.basicAuth, opts.identifier, opts.password);
    const headers = {
        Accept: 'application/json',
    };
    if (creds) {
        headers.Authorization = `Basic ${Buffer.from(creds, 'utf8').toString('base64')}`;
    }
    let payload;
    if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(opts.body);
    }
    const res = await fetch(buildUrl(baseUrl, path, opts.query, opts.filters), {
        method: opts.method ?? 'GET',
        headers,
        body: payload,
        signal: opts.signal,
    });
    const text = await res.text();
    let parsed = text;
    if (text) {
        try {
            parsed = JSON.parse(text);
        }
        catch {
            /* leave as text */
        }
    }
    if (!res.ok) {
        const message = (parsed && typeof parsed === 'object' && 'message' in parsed
            ? String(parsed.message)
            : null) ??
            (parsed && typeof parsed === 'object' && 'error' in parsed
                ? String(parsed.error)
                : null) ??
            `${res.status} ${res.statusText}`;
        throw new ApiError(res.status, message, parsed);
    }
    return parsed;
}
//# sourceMappingURL=client.js.map