const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;

/** Convert Subscene "M/D/YYYY h:mm AM/PM" to "YYYY-MM-DD", or null. */
export function parseSubsceneDate(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(DATE_RE);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const month = mm.padStart(2, '0');
  const day = dd.padStart(2, '0');
  if (Number(month) < 1 || Number(month) > 12) return null;
  if (Number(day) < 1 || Number(day) > 31) return null;
  return `${yyyy}-${month}-${day}`;
}
