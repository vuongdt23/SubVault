import type { RawEntry, Title, Version } from '../types';
import { deriveYear, deriveType } from './derive';
import { parseSubsceneDate } from './dates';
import { slugFromDownload } from './slug';

/** Insert one raw entry (already known to belong to `lang`) into the accumulator. */
export function addEntry(acc: Map<string, Title>, lang: string, e: RawEntry): void {
  const slug = slugFromDownload(e.download);
  let t = acc.get(slug);
  if (!t) {
    t = { slug, title: e.title, year: null, type: 'unknown', languages: {} };
    acc.set(slug, t);
  }
  const version: Version = {
    id: e.subscene_id,
    releases: e.releases ?? [],
    author: e.author ?? '',
    comment: e.comment ?? '',
    date: parseSubsceneDate(e.date ?? ''),
    download: `${lang}/${e.download}`,
    subscene: e.original ?? '',
  };
  (t.languages[lang] ??= []).push(version);
}

/** Finalize a title: compute year/type from all releases across all languages. */
export function finalizeTitle(t: Title): Title {
  const releases: string[] = [];
  for (const versions of Object.values(t.languages)) {
    for (const v of versions) releases.push(...v.releases);
  }
  t.year = deriveYear(t.title, releases);
  t.type = deriveType(t.title, releases);
  return t;
}
