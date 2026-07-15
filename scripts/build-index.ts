import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { insertMultiple } from '@orama/orama';
import { streamMetadata } from '../src/lib/metadata';
import { addEntry, finalizeTitle } from '../src/lib/group';
import { createDb, serialize, toSearchDoc } from '../src/lib/search';
import { shardOf } from '../src/lib/slug';
import type { Title } from '../src/types';

const ROOT = process.env.SUBTITLES_ROOT ?? 'fake-subtitles';
const OUT = 'public/data';
const TITLES_OUT = join(OUT, 'titles');

/** Discover language dirs: ROOT/{lang}/{lang}/{lang}_metadata.json */
async function discoverLanguages(): Promise<{ lang: string; metaPath: string }[]> {
  const found: { lang: string; metaPath: string }[] = [];
  for (const lang of await readdir(ROOT)) {
    const metaPath = join(ROOT, lang, lang, `${lang}_metadata.json`);
    try {
      if ((await stat(metaPath)).isFile()) found.push({ lang, metaPath });
    } catch { /* not a language dir */ }
  }
  return found;
}

async function main() {
  const langs = await discoverLanguages();
  if (langs.length === 0) throw new Error(`No languages found under ${ROOT}`);
  console.log(`Languages: ${langs.map((l) => l.lang).join(', ')}`);

  const acc = new Map<string, Title>();
  let entries = 0, skipped = 0;
  for (const { lang, metaPath } of langs) {
    for await (const e of streamMetadata(metaPath)) {
      if (!e || !e.download || !e.subscene_id) { skipped++; continue; }
      try { addEntry(acc, lang, e); entries++; }
      catch { skipped++; }
    }
    console.log(`  ${lang}: cumulative ${acc.size} titles, ${entries} entries`);
  }
  console.log(`Parsed ${entries} entries, ${skipped} skipped, ${acc.size} unique titles`);

  // Write per-title shards + collect search docs.
  const docs = [];
  const buckets = new Set<string>();
  for (const title of acc.values()) {
    finalizeTitle(title);
    const shard = shardOf(title.slug);
    if (!buckets.has(shard)) {
      await mkdir(join(TITLES_OUT, shard), { recursive: true });
      buckets.add(shard);
    }
    await writeFile(join(TITLES_OUT, shard, `${title.slug}.json`), JSON.stringify(title));
    docs.push(toSearchDoc(title));
  }

  // Build + serialize the Orama index.
  const db = await createDb();
  await insertMultiple(db, docs as any, 500);
  const snapshot = await serialize(db);
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'search-index.json'), snapshot);
  console.log(`Wrote ${docs.length} shards + search-index.json (${(snapshot.length / 1e6).toFixed(1)} MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
