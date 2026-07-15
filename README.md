# SubVault

Static, client-side subtitle metadata browser. Search ~200k titles across
languages; download links resolve to subtitle archives served by nginx.

## Dev (Mac, no real data)

```bash
npm install
npm run gen:fake                                  # synthetic data → fake-subtitles/
SUBTITLES_ROOT=fake-subtitles npm run gen:index   # → public/data/
npm run dev                                       # http://localhost:4321
npm test                                          # unit + smoke tests
```

## How it works

- `scripts/build-index.ts` auto-discovers every `{lang}/{lang}/{lang}_metadata.json`
  under `SUBTITLES_ROOT`, merges entries by title slug across languages, derives
  year/type, writes per-title shards to `public/data/titles/{xx}/{slug}.json`, and
  a serialized Orama index to `public/data/search-index.json`.
- The browser loads the index once and runs search + filtering client-side.
- Detail pages fetch a single shard on demand. The shard directory `{xx}` is a
  2-hex-char FNV-1a hash of the slug, computed by the same dependency-free
  `shardOf` in both Node (build) and the browser (detail page), so paths match.

## Prod (SSH host with real data at /storage/media/subtitles)

```bash
docker compose run --rm indexer     # generate public/data from real metadata
docker compose up --build web       # serve on :8080, archives mounted read-only
```

Add a language by extracting its `.7z` into
`/storage/media/subtitles/{lang}/` — the next `indexer` run picks it up
automatically (no code change).

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

## Prerequisite for full English data

English extraction (PID 2518515 on the SSH host, logging to
`/storage/media/subtitles/english/_extract.log`) must finish before a prod
`indexer` run includes English. Vietnamese is ready now; other languages appear
automatically once their `.7z` is extracted under the subtitles root.
