export type MediaType = 'movie' | 'tv' | 'unknown';
export type LangCode = string; // 'vietnamese' | 'english' | ...

/** One raw metadata record as it appears in {lang}_metadata.json. */
export interface RawEntry {
  subscene_id: string;
  title: string;
  language: string;
  author?: string;
  profile?: string;
  releases?: string[];
  comment?: string;
  download: string;   // e.g. "wrong-turn/wrong-turn_vietnamese-38970.rar"
  original?: string;
  imdb?: string;
  date?: string;      // e.g. "3/29/2005 5:19 PM"
}

/** One subtitle version in the normalized per-title shard. */
export interface Version {
  id: string;
  releases: string[];
  author: string;
  comment: string;
  date: string | null;   // ISO or null
  download: string;      // lang-scoped: "{lang}/{slug}/{file}"
  subscene: string;
}

/** A title merged across all languages. */
export interface Title {
  slug: string;
  title: string;
  year: number | null;
  type: MediaType;
  languages: Record<LangCode, Version[]>;
}

/** The document inserted into Orama (id = slug). year=0 means unknown. */
export interface SearchDoc {
  id: string;
  title: string;
  year: number;
  type: MediaType;
  langs: LangCode[];
  n: number;             // total version count across languages
}

export interface Filters {
  langs: LangCode[];       // OR-combined; empty = any
  type: MediaType | null;  // null = any
  yearFrom: number | null;
  yearTo: number | null;
}
