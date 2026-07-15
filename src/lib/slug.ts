/**
 * 2-hex-char shard (256 buckets) from a pure-JS FNV-1a hash.
 * MUST be dependency-free so the SAME function runs in Node (build) and the
 * browser (detail page) and produces identical shards — do NOT use node:crypto.
 */
export function shardOf(slug: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime, 32-bit
  }
  return ((h >>> 0) & 0xff).toString(16).padStart(2, '0');
}

/** The slug is the first path segment of a download path. */
export function slugFromDownload(download: string): string {
  return download.split('/')[0];
}
