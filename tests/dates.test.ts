import { describe, it, expect } from 'vitest';
import { parseSubsceneDate } from '../src/lib/dates';

describe('parseSubsceneDate', () => {
  it('parses M/D/YYYY h:mm AM/PM to an ISO date string', () => {
    expect(parseSubsceneDate('3/29/2005 5:19 PM')).toBe('2005-03-29');
  });
  it('parses a PM time correctly (date unaffected)', () => {
    expect(parseSubsceneDate('7/6/2005 10:55 AM')).toBe('2005-07-06');
  });
  it('returns null for empty input', () => {
    expect(parseSubsceneDate('')).toBeNull();
  });
  it('returns null for unparseable input', () => {
    expect(parseSubsceneDate('sometime last year')).toBeNull();
  });
});
