import { shardOf } from '../lib/slug';
import type { Title, Version } from '../types';

const $ = (id: string) => document.getElementById(id)!;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function versionRow(v: Version): string {
  const rel = esc(v.releases[0] ?? '(no release name)');
  const meta = [v.date, v.author && `by ${v.author}`].filter(Boolean).map((s) => esc(s as string)).join(' · ');
  const comment = v.comment ? `<div class="take-comment">${esc(v.comment)}</div>` : '';
  return `<div class="take">
    <div class="min-w-0">
      <div class="take-rel">${rel}</div>
      <div class="take-meta">${meta || '—'}</div>${comment}
    </div>
    <a class="btn-amber shrink-0" href="/files/${v.download.split('/').map(encodeURIComponent).join('/')}" download>Download</a>
  </div>`;
}

function section(lang: string, versions: Version[]): string {
  return `<details open class="reel">
    <summary>${esc(lang)}<span class="reel-count">${versions.length} version${versions.length === 1 ? '' : 's'}</span></summary>
    <div>${versions.map(versionRow).join('')}</div>
  </details>`;
}

async function init() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) { $('detail').innerHTML = '<p class="count-note py-16 text-center">No title specified.</p>'; return; }
  const res = await fetch(`/data/titles/${shardOf(slug)}/${encodeURIComponent(slug)}.json`);
  if (!res.ok) { $('detail').innerHTML = '<p class="count-note py-16 text-center">Title not found in the archive.</p>'; return; }
  const t = (await res.json()) as Title;

  $('t-title').textContent = t.title + (t.year ? ` (${t.year})` : '');
  const langCount = Object.keys(t.languages).length;
  const versionCount = Object.values(t.languages).reduce((n, vs) => n + vs.length, 0);
  const typeLabel = t.type !== 'unknown' ? t.type.toUpperCase() : 'TITLE';
  $('t-eyebrow').textContent =
    `${typeLabel} · ${langCount} language${langCount === 1 ? '' : 's'} · ${versionCount} version${versionCount === 1 ? '' : 's'}`;

  $('detail').innerHTML = Object.entries(t.languages)
    .map(([lang, versions]) => section(lang, versions)).join('');
}

init();
