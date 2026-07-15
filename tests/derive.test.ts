import { describe, it, expect } from 'vitest';
import { deriveYear } from '../src/lib/derive';
import { deriveType } from '../src/lib/derive';

describe('deriveYear', () => {
  it('reads a 4-digit year from a release string', () => {
    expect(deriveYear('Wrong Turn', ['Wrong Turn[2003]Eng.DvDrip.NeRoZ'])).toBe(2003);
  });
  it('falls back to the title when releases have no year', () => {
    expect(deriveYear('100 Love 2011', [])).toBe(2011);
  });
  it('returns null when no plausible year exists', () => {
    expect(deriveYear('Constantine', ['Constantine.DVDRip.XviD'])).toBeNull();
  });
  it('ignores 4-digit numbers outside 1900-2029', () => {
    expect(deriveYear('10000 BC', ['10000.BC.2008'])).toBe(2008);
  });
  it('prefers releases over title', () => {
    expect(deriveYear('Remake 1998', ['Remake.2015.BluRay'])).toBe(2015);
  });
});

describe('deriveType', () => {
  it('detects TV from SxxExx in a release', () => {
    expect(deriveType('Banshee', ['Banshee.S01E02.1080p.BluRay'])).toBe('tv');
  });
  it('detects TV from the word Season', () => {
    expect(deriveType('Shrinking Season 2', [])).toBe('tv');
  });
  it('detects TV from "First Season" phrasing', () => {
    expect(deriveType('10 Things I Hate About You First Season', [])).toBe('tv');
  });
  it('defaults to movie when nothing TV-like appears', () => {
    expect(deriveType('Wrong Turn', ['Wrong Turn[2003]Eng.DvDrip'])).toBe('movie');
  });
  it('returns unknown when there is no signal at all', () => {
    expect(deriveType('', [])).toBe('unknown');
  });
});
