import { create, search, load, save, type AnyOrama } from '@orama/orama';
import type { Filters, SearchDoc } from '../types';

// `langs` is declared `enum[]` (not `string[]`) because Orama v3 only supports
// the `containsAll`/`containsAny` array operators on enum arrays; a plain
// `string[]` field cannot be filtered by membership in a `where` clause.
const schema = {
  title: 'string',
  year: 'number',
  type: 'enum',
  langs: 'enum[]',
  n: 'number',
} as const;

export async function createDb(): Promise<AnyOrama> {
  return create({ schema });
}

/** Translate UI filters into an Orama `where` clause. */
export function buildWhere(f: Filters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.type) where.type = { eq: f.type };
  if (f.yearFrom != null || f.yearTo != null) {
    // Orama v3 allows only one operator per field, so a range uses `between`
    // rather than combining `gte` + `lte`.
    where.year = { between: [f.yearFrom ?? 1900, f.yearTo ?? 2029] };
  }
  if (f.langs.length === 1) {
    where.langs = { containsAll: f.langs };
  }
  return where;
}

export interface QueryResult {
  hits: SearchDoc[];
  count: number;
}

/** Run a search + filter. Multi-language selection is OR-combined post-hoc. */
export async function runQuery(
  db: AnyOrama, term: string, f: Filters, limit: number, offset: number,
): Promise<QueryResult> {
  const where = buildWhere(f);
  const res = await search(db, {
    term: term || undefined,
    where: Object.keys(where).length ? where : undefined,
    limit: f.langs.length > 1 ? 10000 : limit,
    offset: f.langs.length > 1 ? 0 : offset,
  } as any);
  let hits = res.hits.map((h: any) => h.document as SearchDoc);
  if (f.langs.length > 1) {
    const set = new Set(f.langs);
    hits = hits.filter((d) => d.langs.some((l) => set.has(l)));
    const count = hits.length;
    return { hits: hits.slice(offset, offset + limit), count };
  }
  return { hits, count: res.count };
}

// Use Orama's built-in save/load rather than @orama/plugin-data-persistence.
// The plugin pulls in `dpack`, which imports Node's `stream`; under a browser
// bundle `stream` is externalized to undefined and the module throws at import
// time ("Class extends value undefined"), killing the search island before any
// query runs. `save` returns plain JSON-serializable RawData, so a JSON string
// is a faithful, dependency-free snapshot that hydrates identically.
export async function serialize(db: AnyOrama): Promise<string> {
  return JSON.stringify(save(db));
}

export async function hydrate(snapshot: string): Promise<AnyOrama> {
  const db = await createDb();
  load(db, JSON.parse(snapshot));
  return db;
}

export function toSearchDoc(t: {
  slug: string; title: string; year: number | null;
  type: SearchDoc['type']; languages: Record<string, unknown[]>;
}): SearchDoc {
  const langs = Object.keys(t.languages);
  const n = langs.reduce((sum, l) => sum + t.languages[l].length, 0);
  return { id: t.slug, title: t.title, year: t.year ?? 0, type: t.type, langs, n };
}
