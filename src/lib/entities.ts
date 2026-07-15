// Subscene metadata stores titles/comments with HTML entities (e.g. "Don&#39;t",
// "La Vita &#232; bella"). Decode them once at build time so both the search
// index and the shards hold clean, human-readable, searchable text. Kept
// dependency-free so it runs the same in Node (build) and anywhere else.

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ntilde: 'ñ',
  ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß', hellip: '…',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

/** Decode HTML character references (named + numeric decimal/hex). */
export function decodeEntities(input: string): string {
  if (!input || input.indexOf('&') === -1) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    const named = NAMED[body.toLowerCase()];
    return named ?? whole;
  });
}
