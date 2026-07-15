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

/**
 * Phrase-relevance tier for a title against the query (lower = better):
 *   0 exact title · 1 title starts with query · 2 query is a substring ·
 *   3 all query words present · 4 fuzzy/partial (Orama matched, we didn't).
 * This fixes Orama's raw BM25 ordering, which buries an exact phrase match
 * ("Red Sorghum") under many shorter loose matches ("Reds", "Redacted", …).
 */
function relevanceTier(title: string, q: string, words: string[]): number {
  const t = title.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.includes(q)) return 2;
  return words.every((w) => t.includes(w)) ? 3 : 4;
}

/** Run a search + filter. Text queries are re-ranked by phrase relevance. */
export async function runQuery(
  db: AnyOrama, term: string, f: Filters, limit: number, offset: number,
): Promise<QueryResult> {
  const where = buildWhere(f);
  const q = term.trim().toLowerCase();
  const needsPostProcess = q.length > 0 || f.langs.length > 1;

  const res = await search(db, {
    term: term || undefined,
    where: Object.keys(where).length ? where : undefined,
    // When we re-rank / OR-filter languages we need the whole matched set.
    limit: needsPostProcess ? 10000 : limit,
    offset: needsPostProcess ? 0 : offset,
  } as any);

  let scored = res.hits.map((h: any) => ({ doc: h.document as SearchDoc, score: h.score as number }));

  if (f.langs.length > 1) {
    const set = new Set(f.langs);
    scored = scored.filter((s) => s.doc.langs.some((l) => set.has(l)));
  }

  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    scored.forEach((s) => ((s as any).tier = relevanceTier(s.doc.title, q, words)));
    scored.sort((a, b) => (a as any).tier - (b as any).tier || b.score - a.score);
  }

  if (needsPostProcess) {
    const count = scored.length;
    return { hits: scored.slice(offset, offset + limit).map((s) => s.doc), count };
  }
  return { hits: scored.map((s) => s.doc), count: res.count };
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
