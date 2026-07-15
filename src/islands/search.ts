import { hydrate, runQuery } from '../lib/search';
import type { AnyOrama } from '@orama/orama';
import type { Filters, MediaType, SearchDoc } from '../types';

const PAGE = 48;
let db: AnyOrama | null = null;
let page = 0;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function readFilters(): Filters {
  const langs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="lang"]:checked'),
  ).map((i) => i.value);
  const typeVal = ($('f-type') as HTMLSelectElement).value;
  const from = ($('f-from') as HTMLInputElement).value;
  const to = ($('f-to') as HTMLInputElement).value;
  return {
    langs,
    type: (typeVal || null) as MediaType | null,
    yearFrom: from ? Number(from) : null,
    yearTo: to ? Number(to) : null,
  };
}

function card(d: SearchDoc): string {
  const year = d.year ? `<span class="text-slate-400">${d.year}</span>` : '';
  const chips = d.langs
    .map((l) => `<span class="rounded bg-slate-700 px-1.5 py-0.5 text-xs">${l.slice(0, 2)}</span>`)
    .join(' ');
  const badge = d.type !== 'unknown'
    ? `<span class="rounded bg-indigo-600 px-1.5 py-0.5 text-xs uppercase">${d.type}</span>` : '';
  return `<a href="/title?slug=${encodeURIComponent(d.id)}"
    class="block rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-indigo-500">
    <div class="flex items-center justify-between gap-2">
      <h3 class="truncate font-medium">${d.title}</h3>${year}
    </div>
    <div class="mt-2 flex items-center gap-1">${badge}${chips}
      <span class="ml-auto text-xs text-slate-400">${d.n} sub${d.n === 1 ? '' : 's'}</span>
    </div></a>`;
}

async function render() {
  if (!db) return;
  const term = ($('q') as HTMLInputElement).value.trim();
  const filters = readFilters();
  const { hits, count } = await runQuery(db, term, filters, PAGE, page * PAGE);
  $('results').innerHTML = hits.map(card).join('') ||
    '<p class="col-span-full text-slate-400">No matches.</p>';
  const pages = Math.max(1, Math.ceil(count / PAGE));
  $('page-info').textContent = `${count.toLocaleString()} titles · page ${page + 1}/${pages}`;
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
  const reset = () => { page = 0; render(); };
  $('q').addEventListener('input', debounce(reset, 180));
  document.querySelectorAll('input[name="lang"], #f-type, #f-from, #f-to')
    .forEach((el) => el.addEventListener('change', reset));
  $('prev').addEventListener('click', () => { if (page > 0) { page--; render(); } });
  $('next').addEventListener('click', () => { page++; render(); });
  render();
}

init();
