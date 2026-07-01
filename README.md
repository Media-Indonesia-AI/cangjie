# cangjie

CLI wrapper for the **beritainvestor** REST API. Mirrors the conventions of `printingpress-cli` (subcommands, `--json` / `--compact` / `--select` / `--csv`, auto-JSON when piped, typed exit codes).

## Scope

| resource   | verbs | path                                       |
| ---------- | ----- | ------------------------------------------ |
| articles   | list  | `GET /v1/article`                          |
| articles   | create | `POST /v1/article`                        |
| tickers    | list  | `GET /v1/stocks/stock-tickers` (limit=10000, never paginated) |
| topics     | list  | `GET /v1/topic`                            |
| stories    | list  | `GET /v1/story`                            |
| stories    | create | `POST /v1/story`                          |
| headlines  | list  | `GET /v1/headlines`                        |
| headlines  | get   | `GET /v1/headlines/{id}`                   |
| headlines  | create | `POST /v1/headlines`                      |
| headlines  | update | `PATCH /v1/headlines/{id}`                 |
| headlines  | delete | `DELETE /v1/headlines/{id}`                |
| headlines  | stories | `GET /v1/headlines/{id}/stories`          |
| headlines  | keywords | `GET /v1/headlines/{id}/keywords`        |
| headlines  | topics  | `GET /v1/headlines/{id}/topics`          |

The OpenAPI spec lives at `http://localhost:3000/v1/docs-json` (local) and `http://145.79.8.90:3007/v1/docs-json` (remote).

## Install from a private repository

```bash
# SSH
npm install -g git+ssh://git@github.com/your-org/cangjie.git

# HTTPS with token
npm install -g https://x-access-token:${GH_TOKEN}@github.com/your-org/cangjie.git

# Private npm registry — uncomment + edit .npmrc first
npm install -g cangjie
```

## Authentication

The API uses **HTTP Basic Auth**: `Authorization: Basic <base64(identifier:password)>` where `identifier` is your email **or** username. Provide creds in any of these ways (highest priority first):

```bash
# 1. Per-invocation
cangjie topics list --identifier alice@example.com --password s3cret

# 2. Pre-encoded "identifier:password"
cangjie topics list --basic-auth alice@example.com:s3cret

# 3. Env vars
export CANGJIE_IDENTIFIER=alice@example.com
export CANGJIE_PASSWORD=s3cret
cangjie topics list

# 4. Config file
echo '{ "identifier": "alice@example.com", "password": "s3cret", "baseUrl": "http://localhost:3000" }' > ~/.cangjie.json
```

`baseUrl` defaults to `http://localhost:3000`. Override with `--base-url` or `CANGJIE_BASE_URL` to point at the remote server (`http://145.79.8.90:3007`).

## Usage

```bash
# Lists
cangjie topics list --limit 5
cangjie articles list --limit 10 --skip 0
cangjie tickers list                # limit is pinned at 10000, no pagination
cangjie stories list --limit 5
cangjie headlines list --limit 10

# Filters — repeat --filter for AND-combined conditions
cangjie stories list --filter sentiment=positive
cangjie headlines list --filter sentiment=positive
cangjie headlines list --filter created_at=gte:2026-06-01

# Create a story (parent headline must already exist; pass its ObjectId)
cangjie stories create \
  --headline "BBCA catat laba Rp 12,5T" \
  --summary "BBCA membukukan laba bersih konsolidasi..." \
  --primary-sentiment positive \
  --recap-date 2026-06-24T00:00:00.000Z \
  --headline-id 665abc123def456789001ccc \
  --article-id 665abc123def456789001aaa \
  --article-id 665abc123def456789001bbb

# Headline lifecycle
cangjie headlines get 665abc123def456789001ccc --json
cangjie headlines stories 665abc123def456789001ccc --limit 5
cangjie headlines keywords 665abc123def456789001ccc
cangjie headlines topics 665abc123def456789001ccc

# Create a headline (attach stories + tags + keyword pivots in one shot)
cangjie headlines create \
  --title "BBCA catat laba bersih Rp 12,5T di K1 2026" \
  --summary "BBCA membukukan laba bersih konsolidasi..." \
  --primary-ticker-code BBCA \
  --sentiment positive \
  --story-id 665abc123def456789001aaa \
  --topic-id 665abc123def456789001111 \
  --keyword label=trading_volume,value=85,description="Volume up 12% vs prior session",sentiment=positive

# Partial update — any of storyIds / topicIds / keywords REPLACE the full set when present
cangjie headlines update 665abc123def456789001ccc \
  --summary "Updated summary..." \
  --story-id 665aaa --story-id 665bbb

cangjie headlines delete 665abc123def456789001ccc

# Create an article
cangjie articles create \
  --title "IDX ends higher on banking rally" \
  --source "kontan.co.id" \
  --published-at 2026-06-22T15:30:00.000Z \
  --content "Full article body in plain text..." \
  --topic-slug saham \
  --topic-slug ekonomi

# Body from stdin (works for both article --content and story --summary)
echo "Long body..." | cangjie articles create --title "x" --source "y" --published-at 2026-06-22T15:30:00.000Z --content -

# Output shaping (matches printingpress-cli flags)
cangjie articles list --json --compact
cangjie stories list --select id,headline,primarySentiment
cangjie topics list --csv > topics.csv
cangjie articles list --quiet         # ids only
cangjie articles list --no-color      # plain
cangjie stories create --headline x ... --dry-run   # print payload, do not send
```

## Exit codes

| code | meaning     |
| ---- | ----------- |
| 0    | success     |
| 2    | usage error |
| 3    | not found   |
| 4    | auth failed |
| 5    | api error   |
| 7    | rate limited|

## Development

```bash
npm install
npm run dev -- topics list --limit 5
npm run build
node dist/cli.js --help
```

## Layout

```
src/
  cli.ts                 entry point
  lib/
    client.ts            fetch wrapper + Basic auth + filters encoding
    config.ts            env + ~/.cangjie.json loader
    output.ts            table / json / csv / compact / select renderer
    flags.ts             shared commander flags + error handler
  commands/
    articles.ts          GET /v1/article, POST /v1/article
    tickers.ts           GET /v1/stocks/stock-tickers (limit pinned at 10000)
    topics.ts            GET /v1/topic
    stories.ts           GET /v1/story, POST /v1/story
    headlines.ts         GET / POST / PATCH / DELETE /v1/headlines[/{id}[/stories|/keywords|/topics]]
```