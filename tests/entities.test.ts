import { describe, it, expect } from 'vitest';
import { decodeEntities } from '../src/lib/entities';

describe('decodeEntities', () => {
  it('decodes numeric decimal entities', () => {
    expect(decodeEntities('Don&#39;t Say a Word')).toBe("Don't Say a Word");
    expect(decodeEntities('La Vita &#232; bella')).toBe('La Vita è bella');
  });
  it('decodes numeric hex entities', () => {
    expect(decodeEntities('caf&#xe9;')).toBe('café');
  });
  it('decodes common named entities', () => {
    expect(decodeEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeEntities('&quot;Quoted&quot; &lt;x&gt;')).toBe('"Quoted" <x>');
    expect(decodeEntities('a&nbsp;b')).toBe('a\u00a0b');
  });
  it('leaves plain text untouched', () => {
    expect(decodeEntities('Wrong Turn')).toBe('Wrong Turn');
  });
  it('leaves unknown/garbage entities as-is', () => {
    expect(decodeEntities('100% & rising')).toBe('100% & rising');
    expect(decodeEntities('&notanentity;')).toBe('&notanentity;');
  });
  it('handles empty string', () => {
    expect(decodeEntities('')).toBe('');
  });
});
