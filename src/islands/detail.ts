import { shardOf } from '../lib/slug';
import type { Title, Version } from '../types';

const $ = (id: string) => document.getElementById(id)!;

function versionRow(lang: string, v: Version): string {
  const rel = v.releases[0] ?? '(no release name)';
  const meta = [v.date, v.author && `by ${v.author}`].filter(Boolean).join(' · ');
  const comment = v.comment ? `<div class="text-xs text-slate-400">${v.comment}</div>` : '';
  return `<li class="flex items-center justify-between gap-3 border-t border-slate-800 py-2">
    <div class="min-w-0"><div class="truncate">${rel}</div>
      <div class="text-xs text-slate-500">${meta}</div>${comment}</div>
    <div class="flex shrink-0 gap-2">
      <a class="rounded bg-indigo-600 px-2 py-1 text-sm" href="/files/${v.download}" download>Download</a>
      <a class="rounded bg-slate-700 px-2 py-1 text-sm" href="${v.subscene}" target="_blank" rel="noreferrer">Subscene</a>
    </div></li>`;
}

function section(lang: string, versions: Version[]): string {
  return `<details open class="rounded-lg border border-slate-700 bg-slate-800">
    <summary class="cursor-pointer px-3 py-2 font-medium capitalize">${lang}
      <span class="text-slate-400">(${versions.length})</span></summary>
    <ul class="px-3 pb-2">${versions.map((v) => versionRow(lang, v)).join('')}</ul>
  </details>`;
}

async function init() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { $('detail').innerHTML = '<p class="text-slate-400">No title specified.</p>'; return; }
  const res = await fetch(`/data/titles/${shardOf(slug)}/${encodeURIComponent(slug)}.json`);
  if (!res.ok) { $('detail').innerHTML = '<p class="text-slate-400">Title not found.</p>'; return; }
  const t = (await res.json()) as Title;
  $('t-title').textContent = t.title + (t.year ? ` (${t.year})` : '');
  $('detail').innerHTML = Object.entries(t.languages)
    .map(([lang, versions]) => section(lang, versions)).join('');
}

init();
