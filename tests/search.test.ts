import { describe, it, expect } from 'vitest';
import { createDb, buildWhere, runQuery, serialize, hydrate } from '../src/lib/search';
import { insertMultiple } from '@orama/orama';
import type { SearchDoc } from '../src/types';

const docs: SearchDoc[] = [
  { id: 'wrong-turn', title: 'Wrong Turn', year: 2003, type: 'movie', langs: ['vietnamese', 'english'], n: 3 },
  { id: 'banshee', title: 'Banshee', year: 2013, type: 'tv', langs: ['english'], n: 5 },
  { id: 'constantine', title: 'Constantine', year: 2005, type: 'movie', langs: ['vietnamese'], n: 1 },
  { id: 'reds', title: 'Reds', year: 1981, type: 'movie', langs: ['english'], n: 2 },
  { id: 'redacted', title: 'Redacted', year: 2007, type: 'movie', langs: ['english'], n: 1 },
  { id: 'red-sorghum', title: 'Red Sorghum', year: 1987, type: 'movie', langs: ['english'], n: 4 },
];

async function seeded() {
  const db = await createDb();
  await insertMultiple(db, docs as any);
  return db;
}

describe('search', () => {
  it('finds titles by fuzzy text', async () => {
    const db = await seeded();
    const r = await runQuery(db, 'wrong', { langs: [], type: null, yearFrom: null, yearTo: null }, 48, 0);
    expect(r.hits.map((h) => h.id)).toContain('wrong-turn');
  });

  it('ranks a full-phrase title match above loose partial matches', async () => {
    const db = await seeded();
    const r = await runQuery(db, 'red sorghum', { langs: [], type: null, yearFrom: null, yearTo: null }, 48, 0);
    // "Red Sorghum" contains the whole phrase; "Reds"/"Redacted" only share a prefix.
    expect(r.hits[0].id).toBe('red-sorghum');
  });

  it('filters by type in-engine', async () => {
    const db = await seeded();
    const r = await runQuery(db, '', { langs: [], type: 'tv', yearFrom: null, yearTo: null }, 48, 0);
    expect(r.hits.map((h) => h.id)).toEqual(['banshee']);
  });

  it('filters by year range in-engine', async () => {
    const db = await seeded();
    const r = await runQuery(db, '', { langs: [], type: null, yearFrom: 2004, yearTo: 2010 }, 48, 0);
    expect(r.hits.map((h) => h.id).sort()).toEqual(['constantine', 'redacted']);
  });

  it('filters by language', async () => {
    const db = await seeded();
    const r = await runQuery(db, '', { langs: ['vietnamese'], type: null, yearFrom: null, yearTo: null }, 48, 0);
    expect(r.hits.map((h) => h.id).sort()).toEqual(['constantine', 'wrong-turn']);
  });

  it('survives a save/hydrate round-trip', async () => {
    const db = await seeded();
    const snapshot = await serialize(db);
    const db2 = await hydrate(snapshot);
    const r = await runQuery(db2, 'banshee', { langs: [], type: null, yearFrom: null, yearTo: null }, 48, 0);
    expect(r.hits.map((h) => h.id)).toEqual(['banshee']);
  });
});
