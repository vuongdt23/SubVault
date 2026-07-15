import { hydrate, runQuery } from '../lib/search';
import type { AnyOrama } from '@orama/orama';
import type { Filters, MediaType, SearchDoc } from '../types';

const PAGE = 48;
let db: AnyOrama | null = null;
let page = 0;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loEl = () => $('yr-lo') as HTMLInputElement;
const hiEl = () => $('yr-hi') as HTMLInputElement;

function readFilters(): Filters {
  const langVal = ($('f-lang') as HTMLSelectElement).value;
  const langs = langVal ? [langVal] : [];
  const typeVal = ($('f-type') as HTMLSelectElement).value;
  const lo = loEl().value ? Number(loEl().value) : null;
  const hi = hiEl().value ? Number(hiEl().value) : null;
  return {
    langs,
    type: (typeVal || null) as MediaType | null,
    yearFrom: lo,
    yearTo: hi,
  };
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function card(d: SearchDoc): string {
  const year = d.year ? `<span class="frame-year">${d.year}</span>` : '';
  const chips = d.langs
    .map((l) => `<span class="chip">${esc(l.slice(0, 3))}</span>`)
    .join('');
  const badge = d.type !== 'unknown'
    ? `<span class="badge">${esc(d.type)}</span>` : '';
  return `<a href="/title?slug=${encodeURIComponent(d.id)}" class="frame group">
    <div class="flex items-start justify-between gap-3">
      <h3 class="frame-title">${esc(d.title)}</h3>${year}
    </div>
    <div class="mt-3.5 flex flex-wrap items-center gap-1.5">${badge}${chips}
      <span class="count-note ml-auto">${d.n} sub${d.n === 1 ? '' : 's'}</span>
    </div></a>`;
}

async function render() {
  if (!db) return;
  const term = ($('q') as HTMLInputElement).value.trim();
  const filters = readFilters();
  const { hits, count } = await runQuery(db, term, filters, PAGE, page * PAGE);
  $('results').innerHTML = hits.map(card).join('') ||
    '<p class="count-note col-span-full py-16 text-center">No reels match this cut. Try loosening a filter.</p>';
  const pages = Math.max(1, Math.ceil(count / PAGE));
  $('page-info').textContent = `${count.toLocaleString()} titles · reel ${page + 1} / ${pages}`;
  ($('prev') as HTMLButtonElement).disabled = page === 0;
  ($('next') as HTMLButtonElement).disabled = page + 1 >= pages;
}

function debounce<F extends (...a: any[]) => void>(fn: F, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...a: Parameters<F>) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

async function init() {
  const res = await fetch('/data/search-index.json');
  db = await hydrate(await res.text());
  // Reel-index stat: total titles in the archive (match-all query).
  const total = await runQuery(db, '', { langs: [], type: null, yearFrom: null, yearTo: null }, 1, 0);
  const stat = document.getElementById('stat-count');
  if (stat) stat.textContent = total.count.toLocaleString();
  const reset = () => { page = 0; render(); };
  $('q').addEventListener('input', debounce(reset, 180));
  document.querySelectorAll('#f-lang, #f-type')
    .forEach((el) => el.addEventListener('change', reset));

  // Year from–to: debounced re-query as you type.
  [loEl(), hiEl()].forEach((el) => el.addEventListener('input', debounce(reset, 220)));

  // Clear resets every filter (and the search term) to defaults.
  $('f-clear').addEventListener('click', () => {
    ($('q') as HTMLInputElement).value = '';
    ($('f-lang') as HTMLSelectElement).value = '';
    ($('f-type') as HTMLSelectElement).value = '';
    loEl().value = '';
    hiEl().value = '';
    reset();
  });

  $('prev').addEventListener('click', () => { if (page > 0) { page--; render(); } });
  $('next').addEventListener('click', () => { page++; render(); });
  render();
}

init();
