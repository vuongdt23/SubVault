import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { hydrate, runQuery } from '../src/lib/search';
import { shardOf } from '../src/lib/slug';
import type { Title } from '../src/types';

const OUT = 'public/data';

beforeAll(() => {
  execFileSync('./node_modules/.bin/tsx', ['scripts/make-fake-data.ts'], { stdio: 'inherit' });
  execFileSync('./node_modules/.bin/tsx', ['scripts/build-index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, SUBTITLES_ROOT: 'fake-subtitles' },
  });
}, 120_000);

describe('build output', () => {
  it('emits a hydratable search index', async () => {
    const snapshot = await readFile(join(OUT, 'search-index.json'), 'utf8');
    const db = await hydrate(snapshot);
    const r = await runQuery(db, 'wrong', { langs: [], type: null, yearFrom: null, yearTo: null }, 48, 0);
    expect(r.hits.map((h) => h.id)).toContain('wrong-turn');
  });

  it('emits a per-title shard with merged languages', async () => {
    const shard = shardOf('wrong-turn');
    const path = join(OUT, 'titles', shard, 'wrong-turn.json');
    await access(path);
    const t = JSON.parse(await readFile(path, 'utf8')) as Title;
    expect(Object.keys(t.languages).sort()).toEqual(['english', 'vietnamese']);
    expect(t.languages.english.length).toBe(5);
    expect(t.year).toBe(2003);
  });
});
