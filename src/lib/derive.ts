import type { MediaType } from '../types';

const YEAR_RE = /\b(19[0-9]\d|20[0-2]\d)\b/;

/** Extract a plausible release year (1900–2029) from releases, else the title. */
export function deriveYear(title: string, releases: string[]): number | null {
  for (const r of releases) {
    const m = r.match(YEAR_RE);
    if (m) return Number(m[1]);
  }
  const m = title.match(YEAR_RE);
  return m ? Number(m[1]) : null;
}

const TV_RE = /\bS\d{1,2}E\d{1,2}\b|\bseason\b|\bepisode\b|\bfirst season\b|\bsecond season\b/i;

/** Best-effort movie/tv classification. Empty title + no releases => unknown. */
export function deriveType(title: string, releases: string[]): MediaType {
  if (!title && releases.length === 0) return 'unknown';
  const blob = `${title} ${releases.join(' ')}`;
  return TV_RE.test(blob) ? 'tv' : 'movie';
}
