import { describe, it, expect } from 'vitest';
import { shardOf, slugFromDownload } from '../src/lib/slug';

describe('shardOf', () => {
  it('returns a 2-char lowercase hex shard', () => {
    expect(shardOf('wrong-turn')).toMatch(/^[0-9a-f]{2}$/);
  });
  it('is deterministic for the same slug', () => {
    expect(shardOf('constantine')).toBe(shardOf('constantine'));
  });
});

describe('slugFromDownload', () => {
  it('extracts the slug (first path segment) from a download path', () => {
    expect(slugFromDownload('wrong-turn/wrong-turn_vietnamese-38970.rar')).toBe('wrong-turn');
  });
});
