// Typed, memoised fetch of /data/<name>.json and the manifest.

import type { Manifest, MastersJson, NormalizationJson } from './types';

const cache = new Map<string, Promise<unknown>>();

/** Base URL for data and API requests. Empty in the browser (same origin / Vite proxy); tests and node set it. */
export let dataBase = '';
export function setDataBase(base: string): void { dataBase = base; cache.clear(); }

export function fetchJson<T>(path: string): Promise<T> {
  const url = dataBase + path;
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

export const fetchManifest = () => fetchJson<Manifest>('/data/manifest.json');
export const fetchNormalization = () => fetchJson<NormalizationJson>('/data/normalization.json');
export const fetchMasters = () => fetchJson<MastersJson>('/data/masters.json');

/** Preload a value (tests, or a synchronous cache warm-up). */
export function primeJson<T>(path: string, value: T): void { cache.set(dataBase + path, Promise.resolve(value)); }
export function clearJsonCache(): void { cache.clear(); }
