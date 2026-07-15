# SubVault

A static, client-side subtitle metadata browser. Search a large multi-language
Subscene dump (hundreds of thousands of titles), filter by language / type /
year, and follow download links to the actual subtitle archives — all served as
static files by nginx, with search running entirely in the browser.

## Data source

The subtitle dump comes from the Internet Archive "Subscene Final" collection,
split per language:

- **Torrent:** <https://archive.org/download/subscene-final-dump/Subscene%20Final%20by%20Language.torrent>

Download and extract each `{lang}.7z` so the on-disk layout under your subtitles
root becomes:

```
{root}/{lang}/{lang}/{lang}_metadata.json
{root}/{lang}/{lang}/{lang} subtitles/{slug}/{slug}_{lang}-{id}.zip   # (or .rar)
```

The build step auto-discovers every language present — add one later by
extracting its `.7z` and re-running the indexer; no code changes needed.

## Quick start (no real data)

You don't need the multi-GB dump to run SubVault — it ships a synthetic dataset
generator.

```bash
npm install
npm run gen:fake                                  # synthetic data → fake-subtitles/
SUBTITLES_ROOT=fake-subtitles npm run gen:index   # → public/data/
npm run dev                                       # http://localhost:4321
npm test                                          # unit + smoke tests
```

## Run with real data (Docker)

Point `SUBTITLES_ROOT` at your extracted archive (see `.env.example`), then:

```bash
export SUBTITLES_ROOT=/path/to/subtitles       # or put it in a .env file
docker compose run --rm indexer                # build public/data from metadata
docker compose up --build web                  # serve on http://localhost:8080
```

- `indexer` is a one-shot container that generates the search index + per-title
  shards, then exits.
- `web` bakes that generated data into an nginx image and serves the site, with
  the subtitle archive tree mounted read-only for `/files/` downloads.

## How it works

- `scripts/build-index.ts` auto-discovers every `{lang}/{lang}/{lang}_metadata.json`
  under `SUBTITLES_ROOT`, merges entries by title slug across languages, derives
  year/type, writes per-title shards to `public/data/titles/{xx}/{slug}.json`, and
  a serialized Orama index to `public/data/search-index.json`.
- The browser loads the index once and runs search + filtering client-side.
- Detail pages fetch a single shard on demand. The shard directory `{xx}` is a
  2-hex-char FNV-1a hash of the slug, computed by the same dependency-free
  `shardOf` in both Node (build) and the browser (detail page), so paths match.

## Tech

Astro (static output) · TypeScript · Tailwind CSS · Orama (client-side search) ·
stream-json (bounded-memory parsing of the large metadata files) · Vitest ·
Docker + nginx.

## Implementation notes

- **Search index (de)serialization** uses Orama's built-in `save`/`load`
  (`@orama/orama`), not `@orama/plugin-data-persistence`. The plugin pulls in
  `dpack` → Node's `stream`, which a browser bundle externalizes to `undefined`,
  throwing at import time and killing the search island. `save`/`load` produce an
  equivalent JSON snapshot with no Node dependencies.
- **Orama `where` filters** (v3): `langs` is declared `enum[]` so
  `containsAll`/`containsAny` work; year ranges use the `between` operator
  (v3 permits only one operator per field, so `gte` + `lte` together is rejected).
- **nginx `/files/` mapping**: on disk the archives live at the doubled-lang path
  `{lang}/{lang}/{lang} subtitles/{slug}/{file}`. The `location ~ ^/files/...`
  block in `nginx.conf` reconstructs this from `/files/{lang}/{slug}/{file}`.
- **`.dockerignore`** intentionally does NOT ignore `public/data`: the `indexer`
  step generates it before the image build and the Dockerfile bakes it into the
  static site. The multi-GB archive tree is an external read-only mount and never
  enters the build context.
