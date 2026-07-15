import { hydrate, runQuery } from '../lib/search';
import type { AnyOrama } from '@orama/orama';
import type { Filters, MediaType, SearchDoc } from '../types';

const PAGE = 48;
type View = 'card' | 'list' | 'table';
const VIEWS: View[] = ['card', 'list', 'table'];
let db: AnyOrama | null = null;
let page = 0;
let view: View = 'card';

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

const href = (d: SearchDoc) => `/title?slug=${encodeURIComponent(d.id)}`;
const langChips = (d: SearchDoc) =>
  d.langs.map((l) => `<span class="chip">${esc(l.slice(0, 3))}</span>`).join('');
const typeBadge = (d: SearchDoc) =>
  d.type !== 'unknown' ? `<span class="badge">${esc(d.type)}</span>` : '';
const subs = (d: SearchDoc) => `${d.n} sub${d.n === 1 ? '' : 's'}`;

function card(d: SearchDoc): string {
  const year = d.year ? `<span class="frame-year">${d.year}</span>` : '';
  return `<a href="${href(d)}" class="frame group">
    <div class="flex items-start justify-between gap-3">
      <h3 class="frame-title">${esc(d.title)}</h3>${year}
    </div>
    <div class="mt-3.5 flex flex-wrap items-center gap-1.5">${typeBadge(d)}${langChips(d)}
      <span class="count-note ml-auto">${subs(d)}</span>
    </div></a>`;
}

function listRow(d: SearchDoc): string {
  const year = d.year ? `<span class="row-year">${d.year}</span>` : '';
  return `<a href="${href(d)}" class="row">
    <span class="row-title">${esc(d.title)}</span>${year}
    <span class="ml-auto flex shrink-0 items-center gap-1.5">${typeBadge(d)}${langChips(d)}
      <span class="count-note pl-1">${subs(d)}</span>
    </span></a>`;
}

function tableRow(d: SearchDoc): string {
  return `<a href="${href(d)}" class="trow">
    <span class="tcell ttitle">${esc(d.title)}</span>
    <span class="tcell tnum">${d.year || '—'}</span>
    <span class="tcell">${d.type !== 'unknown' ? esc(d.type) : '—'}</span>
    <span class="tcell">${d.langs.map((l) => esc(l.slice(0, 3))).join(' ')}</span>
    <span class="tcell tnum">${subs(d)}</span>
  </a>`;
}

function renderResults(hits: SearchDoc[]): string {
  if (hits.length === 0)
    return '<p class="count-note py-16 text-center">No reels match this cut. Try loosening a filter.</p>';
  if (view === 'list') return hits.map(listRow).join('');
  if (view === 'table') {
    const head = `<div class="thead" style="display:contents">
      <span class="tcell">Title</span><span class="tcell tnum">Year</span>
      <span class="tcell">Type</span><span class="tcell">Langs</span>
      <span class="tcell tnum">Subs</span></div>`;
    return head + hits.map(tableRow).join('');
  }
  return hits.map(card).join('');
}

function applyViewClass(): void {
  const el = $('results');
  el.className = view === 'list' ? 'view-list' : view === 'table' ? 'view-table' : 'view-card';
  document.querySelectorAll<HTMLButtonElement>('.viewbtn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
  });
}

async function render() {
  if (!db) return;
  const term = ($('q') as HTMLInputElement).value.trim();
  const filters = readFilters();
  const { hits, count } = await runQuery(db, term, filters, PAGE, page * PAGE);
  applyViewClass();
  $('results').innerHTML = renderResults(hits);
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
  // View mode: ?view= URL param wins (shareable), else saved pref, else card.
  const saved = localStorage.getItem('sv-view') as View | null;
  if (saved && VIEWS.includes(saved)) view = saved;
  const urlView = new URLSearchParams(location.search).get('view') as View | null;
  if (urlView && VIEWS.includes(urlView)) { view = urlView; localStorage.setItem('sv-view', urlView); }

  document.querySelectorAll<HTMLButtonElement>('.viewbtn').forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.dataset.view as View;
      if (v === view) return;
      view = v;
      localStorage.setItem('sv-view', v);
      render();
    });
  });

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
