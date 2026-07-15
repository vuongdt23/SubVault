# SubVault — Static Subtitle Indexing Site (Design)

**Date:** 2026-07-15
**Status:** Approved design, pending spec review

## Purpose

A static, client-side website to browse and search a large dump of Subscene
subtitle metadata, with download links to the actual subtitle archives. Local
use only — no SEO, auth, analytics, or legal/publishing concerns. Codebase lives
on the Mac; production is hosted on the homelab SSH host (which has filesystem
access to the data) via Docker Compose.

## Data Source (ground truth on SSH host)

Per-language dumps, uniform layout. Each language originates from a `.7z` in
`/storage/downloads/Subscene Final by Language/` and extracts to:

```
/storage/media/subtitles/{lang}/{lang}/
    {lang}_metadata.json                         # metadata for that language
    {lang} subtitles/{slug}/{slug}_{lang}-{id}.zip   # (or .rar) archives
```

**Measured scale:**

| Language   | Metadata | Entries      | Files (uncompressed) | Notes                          |
|------------|----------|--------------|----------------------|--------------------------------|
| Vietnamese | 70 MB    | 92,625       | ~92k (4.4 GB)        | Already extracted              |
| English    | 624 MB   | ~830,937*    | 830,937 (37.4 GB)    | Extracting as of design time   |
| (20 others)| —        | —            | —                    | Still `.7z`; added when extracted |

\* English uncompressed = 830,937 files / 132,658 folders / 37.4 GB (from 7z headers).

**Metadata record shape** (per entry, all languages identical):

```json
{
  "subscene_id": "38970",
  "title": "Wrong Turn",
  "language": "Vietnamese",
  "author": "",
  "profile": "https://subscene.com/u/",
  "releases": ["Wrong Turn[2003]Eng.DvDrip.NeRoZ"],
  "comment": "Bản dịch gốc",
  "download": "wrong-turn/wrong-turn_vietnamese-38970.rar",
  "original": "https://subscene.com/subtitles/wrong-turn/vietnamese/38970",
  "imdb": "https://www.imdb.com/title/tt0295700",
  "date": "3/29/2005 5:19 PM"
}
```

**Field coverage (Vietnamese sample of 92,625):** `imdb` 95%, `releases`
non-empty 98%, `download` 100% (96% `.zip`, 4% `.rar`), `author`/`comment`
sparse. `language` is uniform within a file. **No explicit `year` or media-type
field** — both are derived (see below). `download` paths are language-scoped, so
they never collide across languages. The same movie slug recurs across languages.

## Key Decisions

- **Group by title (merge languages).** Browse ~unique titles, not raw entries.
  A title card aggregates every language + version under one slug.
- **Multi-language is a first-class facet.** Language filter is meaningful now
  (was moot when VI-only).
- **Year:** derived, nullable. Regex from `releases[]` then `title`
  (`(19|20)\d{2}`). ~49% coverage on VI; shown only when found.
- **Media type:** best-effort heuristic → `movie | tv | unknown`. `tv` if
  `SxxExx` / `Season` / `Episode` appears in title or releases; else `movie`;
  `unknown` reserved for ambiguous. Visible `unknown` bucket; accepted imperfect.
- **Downloads:** served by nginx from the mounted subtitles volume on the SSH
  host. Codebase stays on the Mac.
- **Languages ingested:** auto-discover — build processes every `{lang}/` dir
  present under the subtitles root. New languages appear with zero code change
  once extracted.
- **Detail view:** per-language collapsible sections, each listing versions.

## Stack

**TypeScript end-to-end.** No plain-JS source files.

- **Astro** (static output, `output: 'static'`) — site shell + routing. TS in
  `.astro` frontmatter and islands.
- **TypeScript** — build script, shared types, island logic. `strict: true`.
- **Tailwind CSS** — styling (`@astrojs/tailwind`).
- **Orama** — client-side search engine (typed). Inverted index with typo
  tolerance and native field filtering. **Chosen over Fuse.js because Fuse scans
  every record per keystroke (O(n), fine at ~23k VI-only titles but seconds-slow
  once English pushes the index to ~200k titles).** Orama queries touch only
  matching term buckets → sub-10ms even at hundreds of thousands of docs.
- **Build script:** `.ts`, run via **tsx** (`tsx scripts/build-index.ts`) — no
  separate compile step for tooling. Streams large metadata via a streaming JSON
  parser (`stream-json`) to bound memory on the 624 MB English file.
- **Tests:** **Vitest** (native TS, fast) over the transform functions.
- **Shared types** live in `src/types.ts` and are imported by both the build
  script and the Astro/island code, so the on-disk JSON contract is typed once
  and enforced on both producer and consumer sides.

## Architecture

Client-side static app; no backend. Astro builds a tiny static shell; a
TypeScript build script transforms metadata into a **prebuilt, serialized Orama
index** + per-title shards. The browser loads the prebuilt index (no
index-building on page load) and Orama powers search + filtering in one pass; the
detail view fetches one small JSON.

```
Build script (TypeScript via tsx; auto-discovers languages under SUBTITLES_ROOT):
  For each {lang}/ dir:  {lang}_metadata.json   (VI 70MB · EN ~624MB · …)
        │
        ├─ group entries by title-slug  (MERGE across languages)
        ├─ derive year   (releases[] / title regex)
        ├─ derive type   (movie/tv/unknown heuristic)
        │
        ├─ insert each title into an Orama index (searchable: title;
        │     filterable/faceted: year, type, langs)
        │
        ├──► public/data/search-index.json  Orama.save() serialized index
        │       (loaded once client-side via Orama.load — no rebuild on page load)
        └──► public/data/titles/{xx}/{slug}.json
                versions grouped by language + download path + subscene link

Runtime (nginx in Docker on SSH host, gzip on):
  /               → Orama search + in-engine filter(lang, year, type); client paginates
  /title/{slug}   → fetch one title JSON; per-language collapsible version lists
  /files/{lang}/… → nginx serves .zip/.rar from mounted subtitles volume
```

**Why this approach** (vs. full static prerender of every title, or one fat
client SPA): fast builds (seconds, not minutes over ~100k+ HTML files), tiny page
weight, and it scales cleanly as entries approach ~1M. Hash-sharding titles into
256 subdirs keeps any one directory small.

**Scale note:** the search index carries one row per unique title —
**~180k–210k titles** after the VI+EN cross-language merge (VI 23,174; EN
~200k est.). At this size an O(n)-per-keystroke scanner (Fuse.js) is too slow, so
the index is a **prebuilt Orama inverted index**: term/prefix lookups touch only
matching buckets → sub-10ms queries client-side. The serialized index is the one
larger asset (est. ~15–40 MB raw → smaller gzipped over nginx); it loads once on
first visit and is cached. If it grows unwieldy, it can be split by first
character and lazy-loaded, without rearchitecting.

## Data Model

Per-title JSON (`public/data/titles/{xx}/{slug}.json`, `xx` = first 2 hex of a
hash of slug):

```jsonc
{
  "slug": "wrong-turn",
  "title": "Wrong Turn",
  "year": 2003,            // derived, nullable
  "type": "movie",         // movie | tv | unknown
  "languages": {
    "vietnamese": [
      { "id": "38970",
        "releases": ["Wrong Turn[2003]Eng.DvDrip.NeRoZ"],
        "author": "", "comment": "Bản dịch gốc", "date": "2005-03-29",
        "download": "vietnamese/wrong-turn/wrong-turn_vietnamese-38970.rar",
        "subscene": "https://subscene.com/subtitles/wrong-turn/vietnamese/38970" }
    ],
    "english": [ /* … */ ]
  }
}
```

Orama document per title (the searchable/filterable record inserted at build
time; `id` = slug so results link straight to the shard):

```ts
{ id: 'wrong-turn', title: 'Wrong Turn', year: 2003,
  type: 'movie', langs: ['vietnamese','english'], n: 5 }
// schema: title=string (searchable); year=number, type=enum,
//         langs=string[], n=number (filterable/faceted)
```

**Shared types** (`src/types.ts`, imported by build script and UI):

```ts
export type MediaType = 'movie' | 'tv' | 'unknown';
export type LangCode = string; // 'vietnamese' | 'english' | …

export interface Version {
  id: string;
  releases: string[];
  author: string;
  comment: string;
  date: string | null;      // ISO, nullable if unparseable
  download: string;         // lang-scoped relative path
  subscene: string;
}

export interface Title {
  slug: string;
  title: string;
  year: number | null;
  type: MediaType;
  languages: Record<LangCode, Version[]>;
}

// Orama search document (id = slug; year null-year titles indexed as 0 and
// excluded from year filters). Mirrors the schema registered at build time.
export interface SearchDoc {
  id: string; title: string; year: number; type: MediaType;
  langs: LangCode[]; n: number;
}
```

## Components (Astro + Tailwind + Orama)

- **SearchStore** — loads the serialized Orama index once (`Orama.load`), exposes
  a single `query(text, filters, page)` that runs search + filters in one Orama
  call. Shared by the components below.
- **SearchBar** — debounced text input feeding the store's query.
- **Filters** — language (multi-select), year (decade/range), type. Passed as
  Orama `where` clauses (in-engine filtering), not post-filtered. An empty query
  with only filters is a match-all + `where` (browse mode).
- **ResultsGrid + Pagination** — title cards (title, year, type badge, language
  chips, version count); Orama returns paged results (`limit`/`offset`, ~48/page)
  so pagination is engine-driven.
- **TitleDetail** — fetches one title JSON; per-language collapsible sections
  with version rows (release, date, author, comment), download link, Subscene
  link.
- Interactivity via small Astro islands / vanilla JS; no heavy framework runtime.

## Dev vs Prod

- **Dev (Mac):** `scripts/make-fake-data.ts` generates a small synthetic
  `fake-subtitles/` tree (2 languages, ~40 titles, tiny placeholder `.zip`/`.rar`
  files) + matching metadata. `npm run dev` works with zero access to the real
  4.4 GB / 37 GB data. Build script reads `SUBTITLES_ROOT` (defaults to the fake
  dir in dev).
- **Prod (SSH host):** `docker-compose.yml` mounts the real subtitles root
  read-only. A build stage runs the transform against real metadata → static
  output; nginx serves the site + `/files/`. `SUBTITLES_ROOT` env var switches
  sources.

## Error Handling

- **Build:** skip malformed/incomplete entries, log a skipped count; missing
  year/type → `null` / `unknown`, never crash. Stream-parse large metadata
  (English 624 MB) via `stream-json` to bound memory.
- **Runtime:** missing title JSON → friendly 404 card; missing archive → nginx
  404, link visibly marked unavailable.

## Testing

- Unit-test the risky transform logic against fixtures: `deriveYear`,
  `deriveType`, `groupByTitle` (cross-language merge), slug hashing/sharding.
- Search: build an Orama index from fixtures, `save()`→`load()` round-trip, and
  assert queries return expected titles and that `where` filters (lang/year/type)
  narrow correctly — this is the behavior most likely to regress.
- Smoke-test: build against the fake dataset emits a loadable `search-index.json`
  and the expected title shards; a sampled title JSON has correct structure.

## Out of Scope (YAGNI)

Auth, server-side search, IMDB enrichment/API lookups, SEO, full-text search of
subtitle contents, editing/upload, non-subtitle media.

## Open Prerequisite

English extraction (PID 2518515 on SSH host, logging to
`/storage/media/subtitles/english/_extract.log`) must finish before a prod build
includes English. Vietnamese is ready now.
