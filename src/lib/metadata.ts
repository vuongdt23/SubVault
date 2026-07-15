import { createReadStream } from 'node:fs';
import streamArrayMod from 'stream-json/streamers/stream-array.js';
import type { RawEntry } from '../types';

const { withParserAsStream } = streamArrayMod;

/** Async-iterate a large top-level JSON array without loading it all in memory. */
export async function* streamMetadata(path: string): AsyncGenerator<RawEntry> {
  const pipeline = withParserAsStream();
  createReadStream(path).pipe(pipeline);
  for await (const item of pipeline as AsyncIterable<{ key: number; value: RawEntry }>) {
    yield item.value;
  }
}
