import { describe, it, expect } from 'vitest';
import { addEntry, finalizeTitle } from '../src/lib/group';
import type { RawEntry, Title } from '../src/types';

const vi: RawEntry = {
  subscene_id: '38970', title: 'Wrong Turn', language: 'Vietnamese',
  releases: ['Wrong Turn[2003]Eng.DvDrip.NeRoZ'], comment: 'goc', author: '',
  download: 'wrong-turn/wrong-turn_vietnamese-38970.rar',
  original: 'https://subscene.com/subtitles/wrong-turn/vietnamese/38970',
  date: '3/29/2005 5:19 PM',
};
const en: RawEntry = {
  subscene_id: '99999', title: 'Wrong Turn', language: 'English',
  releases: ['Wrong.Turn.2003.720p'], comment: '', author: 'joe',
  download: 'wrong-turn/wrong-turn_english-99999.zip',
  original: 'https://subscene.com/subtitles/wrong-turn/english/99999',
  date: '1/2/2006 8:00 AM',
};

describe('grouping', () => {
  it('merges entries of the same slug across languages into one title', () => {
    const acc = new Map<string, Title>();
    addEntry(acc, 'vietnamese', vi);
    addEntry(acc, 'english', en);
    expect(acc.size).toBe(1);
    const t = finalizeTitle(acc.get('wrong-turn')!);
    expect(Object.keys(t.languages).sort()).toEqual(['english', 'vietnamese']);
    expect(t.languages.vietnamese[0].download).toBe('vietnamese/wrong-turn/wrong-turn_vietnamese-38970.rar');
    expect(t.languages.vietnamese[0].date).toBe('2005-03-29');
    expect(t.languages.vietnamese[0].subscene).toBe(vi.original);
    expect(t.year).toBe(2003);
    expect(t.type).toBe('movie');
  });
});
