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

Note the **doubled `{lang}/{lang}` directory** — this is required. Some archives
extract "flat" (e.g. `english/english_metadata.json` instead of
`english/english/english_metadata.json`). If yours did, nest it one level:

```bash
cd {root}/english
mkdir -p english
mv english_metadata.json "english subtitles" CREDITS.txt english/
```

(These are renames on the same filesystem, so it's instant even for large trees.)

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

## Run with Docker — TL;DR

Have Docker installed and your subtitles extracted? Three commands:

```bash
echo "SUBTITLES_ROOT=/path/to/subtitles" > .env   # folder containing english/, vietnamese/, …
docker compose run --rm indexer                    # build the search data (a few minutes)
docker compose up --build -d --no-deps web         # serve it → http://localhost:8080
```

That's it — open <http://localhost:8080>. To update later: `git pull` then re-run
the last command (add the `indexer` step only if your data changed). The
step-by-step guide below explains each part if you're new to Docker.

## Run with real data (Docker) — step by step

This is the recommended way to run SubVault against the full dataset. You don't
need Node, npm, or any build tools installed — Docker does everything in
containers. If you've never used Docker, this section walks through it.

### 0. Install Docker

Install **Docker Desktop** (Mac/Windows) or **Docker Engine + the Compose
plugin** (Linux): <https://docs.docker.com/get-docker/>. Verify it works:

```bash
docker --version
docker compose version
```

Both should print a version. On Linux, if `docker` needs `sudo`, either prefix
the commands below with `sudo` or add yourself to the `docker` group.

### 1. Tell SubVault where your subtitles live

Copy the example env file and edit the one line in it to point at the folder you
extracted the archive into (the folder that *contains* `english/`,
`vietnamese/`, etc.):

```bash
cp .env.example .env
# then edit .env so it reads, e.g.:
# SUBTITLES_ROOT=/storage/media/subtitles
```

Docker Compose reads `.env` automatically, so you set this once. (Make sure the
layout matches the doubled `{lang}/{lang}` structure described in **Data
source** above.)

### 2. Build the search data (one-shot)

```bash
docker compose run --rm indexer
```

This starts a temporary container that reads your metadata and writes the search
index + per-title files into `./public/data`, then removes itself (`--rm`). It
prints progress and finishes with a line like `Wrote 133830 shards +
search-index.json`. For the full English + Vietnamese dump this takes a few
minutes and only needs to be re-run when your data changes.

### 3. Build and start the website

```bash
docker compose up --build -d web
```

- `--build` builds the site image (bakes in the data from step 2).
- `-d` runs it in the background ("detached").

Then open **<http://localhost:8080>** in your browser.

> **Note:** `web` depends on `indexer`, so `docker compose up web` will try to
> re-run the (slow) indexer first. Once step 2 has succeeded once, skip the
> re-run with:
> ```bash
> docker compose up --build -d --no-deps web
> ```

### Everyday commands

```bash
docker compose logs -f web     # watch the web server's logs (Ctrl-C to stop watching)
docker compose ps              # see what's running
docker compose stop            # stop the site (keeps everything)
docker compose start web       # start it again
docker compose down            # stop and remove the containers
```

### Updating to a new version

```bash
git pull
docker compose run --rm indexer                 # only if the data/indexer changed
docker compose up --build -d --no-deps web       # rebuild + restart the site
```

### Troubleshooting

- **Downloads 404 / "No such file":** the archive volume isn't mounted where the
  app expects. Check `SUBTITLES_ROOT` in `.env` points at the folder *containing*
  the language dirs, then recreate: `docker compose up -d --force-recreate web`.
  Confirm the mount with `docker compose exec web ls /subtitles` — you should see
  your language folders.
- **Only one language shows up:** the other language isn't in the doubled
  `{lang}/{lang}/…` layout (see **Data source**). Fix the folders and re-run the
  indexer.
- **Port 8080 already in use:** change the left number under `ports:` in
  `docker-compose.yml` (e.g. `"9090:80"`) and open that port instead.

### What the two services do

- **`indexer`** — a one-shot container that generates the search index +
  per-title shards into `./public/data`, then exits.
- **`web`** — builds those files into an nginx image and serves the site, with
  your subtitle archive tree mounted read-only for `/files/` downloads.

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
