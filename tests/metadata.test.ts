import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { streamMetadata } from '../src/lib/metadata';
import type { RawEntry } from '../src/types';

let dir: string;
let file: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sv-'));
  file = join(dir, 'meta.json');
  const data = [
    { subscene_id: '1', title: 'A', language: 'English', download: 'a/a_english-1.zip' },
    { subscene_id: '2', title: 'B', language: 'English', download: 'b/b_english-2.zip' },
  ];
  await writeFile(file, JSON.stringify(data), 'utf8');
});
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

describe('streamMetadata', () => {
  it('yields each top-level array element as an object', async () => {
    const out: RawEntry[] = [];
    for await (const e of streamMetadata(file)) out.push(e);
    expect(out.length).toBe(2);
    expect(out[0].subscene_id).toBe('1');
    expect(out[1].download).toBe('b/b_english-2.zip');
  });
});
