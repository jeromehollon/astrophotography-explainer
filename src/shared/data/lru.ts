// Byte-capped LRU: entries are evicted from the least recently used end when the total exceeds `maxBytes`.

export class ByteLru<V> {
  private map = new Map<string, { value: V; bytes: number }>();
  private total = 0;
  constructor(public maxBytes: number) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    this.map.set(key, e); // move to the MRU end
    return e.value;
  }

  has(key: string): boolean { return this.map.has(key); }

  set(key: string, value: V, bytes: number): void {
    const old = this.map.get(key);
    if (old) { this.total -= old.bytes; this.map.delete(key); }
    if (bytes > this.maxBytes) return; // never cache something bigger than the whole cache
    this.map.set(key, { value, bytes });
    this.total += bytes;
    for (const [k, e] of this.map) {
      if (this.total <= this.maxBytes) break;
      this.map.delete(k);
      this.total -= e.bytes;
    }
  }

  clear(): void { this.map.clear(); this.total = 0; }
  get bytes(): number { return this.total; }
  get size(): number { return this.map.size; }
}
