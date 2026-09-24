// Tests for GET /api/roi against a tiny synthetic runtime directory (SPEC §4.3, docs/contracts.md),
// plus one integration check against the real runtime when ASTRO_DATA points at it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer, resolveRoi } from './index.js';

const W = 20;
const H = 13;

/** Bin a 2-D Float64 array (row-major, w x h) by b, dropping the partial trailing block. */
function binMean(arr, w, h, b) {
  const bw = Math.floor(w / b);
  const bh = Math.floor(h / b);
  const out = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      let s = 0;
      for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) s += arr[(y * b + j) * w + x * b + i];
      out[y * bw + x] = s / (b * b);
    }
  }
  return { data: out, w: bw, h: bh };
}

function writeLE(file, typed) {
  fs.writeFileSync(file, Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
}

let dir;
let app;
const light = new Uint16Array(W * H).map((_, i) => (i * 37) % 65536);
const master = new Float32Array(W * H).map((_, i) => i * 0.5 + 100);
const lightF64 = Float64Array.from(light);
const masterF64 = Float64Array.from(master);

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roi-test-'));
  fs.mkdirSync(path.join(dir, 'pixels'));
  writeLE(path.join(dir, 'pixels', 'f03.b1.u16'), light);
  writeLE(path.join(dir, 'pixels', 'bias.b1.f32'), master);
  for (const b of [2, 4, 8]) {
    writeLE(path.join(dir, 'pixels', `f03.b${b}.f32`), binMean(lightF64, W, H, b).data);
    writeLE(path.join(dir, 'pixels', `bias.b${b}.f32`), binMean(masterF64, W, H, b).data);
  }
  const files = (id, d1) => ({ 1: `pixels/${id}.b1.${d1}`, 2: `pixels/${id}.b2.f32`, 4: `pixels/${id}.b4.f32`, 8: `pixels/${id}.b8.f32` });
  const manifest = {
    reference: 'f07',
    pixel_scale_arcsec: 0.277,
    assets: {
      f03: { id: 'f03', kind: 'light', width: W, height: H, dtype: 'u16', files: files('f03', 'u16'), H: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      bias: { id: 'bias', kind: 'master', width: W, height: H, dtype: 'f32', files: files('bias', 'f32') },
      ghost: { id: 'ghost', kind: 'master', width: W, height: H, dtype: 'f32', files: files('ghost', 'f32') },
    },
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, 'stars.json'), '{"ok":true}');
  app = await buildServer({ dataDir: dir, distDir: path.join(dir, 'no-dist') });
});

afterAll(async () => {
  await app?.close();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

const get = (qs) => app.inject({ method: 'GET', url: `/api/roi${qs}` });

describe('GET /api/roi', () => {
  it('streams the whole u16 image with the contract headers when no rect is given', async () => {
    const res = await get('?id=f03');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['x-roi']).toBe(`0,0,${W},${H}`);
    expect(res.headers['x-width']).toBe(String(W));
    expect(res.headers['x-height']).toBe(String(H));
    expect(res.headers['x-dtype']).toBe('u16');
    expect(res.headers['content-length']).toBe(String(W * H * 2));
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['access-control-expose-headers']).toBe('X-Roi, X-Width, X-Height, X-Dtype');
    const body = res.rawPayload;
    expect(body.length).toBe(W * H * 2);
    expect(Array.from(new Uint16Array(body.buffer, body.byteOffset, W * H))).toEqual(Array.from(light));
  });

  it('crops a rectangle at bin 1 (row-major, requested columns only)', async () => {
    const res = await get('?id=f03&x=3&y=2&w=5&h=4');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-roi']).toBe('3,2,5,4');
    expect(res.headers['content-length']).toBe(String(5 * 4 * 2));
    const got = new Uint16Array(res.rawPayload.buffer, res.rawPayload.byteOffset, 20);
    const want = [];
    for (let y = 2; y < 6; y++) for (let x = 3; x < 8; x++) want.push(light[y * W + x]);
    expect(Array.from(got)).toEqual(want);
  });

  it('clamps the rectangle to the image and reports the clamped rect', async () => {
    const res = await get('?id=f03&x=15&y=10&w=100&h=100');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-roi']).toBe('15,10,5,3');
    expect(res.headers['x-width']).toBe('5');
    expect(res.headers['x-height']).toBe('3');
    expect(res.rawPayload.length).toBe(5 * 3 * 2);
  });

  it('serves f32 masters at bin 1', async () => {
    const res = await get('?id=bias&x=0&y=12&w=20&h=1');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-dtype']).toBe('f32');
    expect(res.headers['content-length']).toBe(String(W * 4));
    const got = new Float32Array(res.rawPayload.buffer.slice(res.rawPayload.byteOffset, res.rawPayload.byteOffset + W * 4));
    expect(Array.from(got)).toEqual(Array.from(master.subarray(12 * W, 13 * W)));
  });

  it.each([2, 4, 8])('serves the bin-%i pyramid as f32 with floor(W/b) x floor(H/b) samples', async (b) => {
    const res = await get(`?id=f03&bin=${b}`);
    expect(res.statusCode).toBe(200);
    const bw = Math.floor(W / b);
    const bh = Math.floor(H / b);
    expect(res.headers['x-dtype']).toBe('f32');
    expect(res.headers['x-width']).toBe(String(bw));
    expect(res.headers['x-height']).toBe(String(bh));
    expect(res.headers['x-roi']).toBe(`0,0,${bw * b},${bh * b}`);
    expect(res.headers['content-length']).toBe(String(bw * bh * 4));
    const got = new Float32Array(res.rawPayload.buffer.slice(res.rawPayload.byteOffset, res.rawPayload.byteOffset + bw * bh * 4));
    expect(Array.from(got)).toEqual(Array.from(binMean(lightF64, W, H, b).data));
  });

  it('crops at bin 2 in bin-1 units and clamps to the binned extent', async () => {
    // x=4,y=2,w=6,h=4 -> samples (2..4, 1..2); bin-2 file is 10x6 (13 rows -> 6)
    const res = await get('?id=f03&x=4&y=2&w=6&h=4&bin=2');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-roi']).toBe('4,2,6,4');
    expect(res.headers['x-width']).toBe('3');
    expect(res.headers['x-height']).toBe('2');
    const b2 = binMean(lightF64, W, H, 2);
    const got = new Float32Array(res.rawPayload.buffer.slice(res.rawPayload.byteOffset, res.rawPayload.byteOffset + 24));
    const want = [];
    for (let y = 1; y < 3; y++) for (let x = 2; x < 5; x++) want.push(b2.data[y * b2.w + x]);
    expect(Array.from(got)).toEqual(want);

    // y=10,h=8 at bin 2 clamps to the 12 rows the bin file covers -> h=2
    const clamped = await get('?id=f03&x=0&y=10&w=20&h=8&bin=2');
    expect(clamped.statusCode).toBe(200);
    expect(clamped.headers['x-roi']).toBe('0,10,20,2');
    expect(clamped.headers['x-height']).toBe('1');
  });

  it('returns 404 for an unknown id or a missing pixel file', async () => {
    expect((await get('?id=nope')).statusCode).toBe(404);
    expect((await get('?id=ghost')).statusCode).toBe(404);
  });

  it.each([
    ['', 'missing id'],
    ['?id=f03&bin=3', 'bin not in {1,2,4,8}'],
    ['?id=f03&x=-1', 'negative x'],
    ['?id=f03&x=1.5', 'non-integer x'],
    ['?id=f03&w=abc', 'non-numeric w'],
    ['?id=f03&w=0', 'zero w'],
    ['?id=f03&x=1&bin=2', 'x not a multiple of bin'],
    ['?id=f03&w=6&bin=4', 'w not a multiple of bin'],
    ['?id=f03&x=20', 'x beyond the image'],
    ['?id=f03&y=8&bin=8', 'y beyond the binned extent'],
  ])('returns 400 for %s (%s)', async (qs) => {
    const res = await get(qs);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('serves runtime JSON under /data and 404s everything else there', async () => {
    const ok = await app.inject({ method: 'GET', url: '/data/stars.json' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'GET', url: '/data/pixels/f03.b1.u16' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/other' })).statusCode).toBe(404);
  });
});

describe('resolveRoi', () => {
  const asset = { width: 6224, height: 4168, dtype: 'u16', files: { 1: 'a', 2: 'b', 4: 'c', 8: 'd' } };
  it('handles the real sensor size at bin 8 (4168 is not a multiple of 8)', () => {
    const r = resolveRoi(asset, { bin: '8' });
    expect([r.fileW, r.fileH, r.sw, r.sh]).toEqual([778, 521, 778, 521]);
    expect(r.rect).toEqual({ x: 0, y: 0, w: 6224, h: 4168 });
  });
});

const REAL = process.env.ASTRO_DATA;
const haveReal = REAL && fs.existsSync(path.join(REAL, 'manifest.json')) && fs.existsSync(path.join(REAL, 'pixels', 'f03.b2.f32'));

describe.skipIf(!haveReal)('real runtime (ASTRO_DATA)', () => {
  it('serves a bin-2 crop of f03 with the expected geometry', async () => {
    const real = await buildServer({ dataDir: REAL, distDir: path.join(REAL, 'no-dist') });
    try {
      const res = await real.inject({ method: 'GET', url: '/api/roi?id=f03&x=100&y=200&w=64&h=32&bin=2' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-roi']).toBe('100,200,64,32');
      expect(res.headers['x-width']).toBe('32');
      expect(res.headers['x-height']).toBe('16');
      expect(res.headers['x-dtype']).toBe('f32');
      expect(res.rawPayload.length).toBe(32 * 16 * 4);
      const v = new Float32Array(res.rawPayload.buffer.slice(res.rawPayload.byteOffset, res.rawPayload.byteOffset + 4))[0];
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(65536);
    } finally {
      await real.close();
    }
  });
});
