import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'fake-subtitles';
const LANGS = ['vietnamese', 'english'];
const TITLES = [
  { slug: 'wrong-turn', title: 'Wrong Turn', rel: 'Wrong.Turn.2003.DVDRip' },
  { slug: 'banshee', title: 'Banshee', rel: 'Banshee.S01E02.1080p.BluRay' },
  { slug: 'constantine', title: 'Constantine', rel: 'Constantine.2005.720p' },
  { slug: 'shrinking', title: 'Shrinking', rel: 'Shrinking.Season.2.1080p' },
];

async function main() {
  await rm(ROOT, { recursive: true, force: true });
  for (const lang of LANGS) {
    const base = join(ROOT, lang, lang);
    const subs = join(base, `${lang} subtitles`);
    const entries = [];
    let id = 1000;
    for (const t of TITLES) {
      // ~40 versions total: 5 versions per title per language
      for (let v = 0; v < 5; v++) {
        id++;
        const file = `${t.slug}_${lang}-${id}.zip`;
        const dir = join(subs, t.slug);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, file), `PK fake ${lang} ${t.slug} v${v}`);
        entries.push({
          subscene_id: String(id),
          title: t.title,
          language: lang,
          author: v % 2 ? 'alice' : '',
          releases: [`${t.rel}.v${v}`],
          comment: v === 0 ? 'original' : '',
          download: `${t.slug}/${file}`,
          original: `https://subscene.com/subtitles/${t.slug}/${lang}/${id}`,
          imdb: 'https://www.imdb.com/title/tt0000000',
          date: `1/${(v % 28) + 1}/200${v} 5:19 PM`,
        });
      }
    }
    await mkdir(base, { recursive: true });
    await writeFile(join(base, `${lang}_metadata.json`), JSON.stringify(entries, null, 2));
  }
  console.log(`fake data written to ${ROOT}/ (${LANGS.length} langs, ${TITLES.length} titles)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
