import { describe, expect, it } from 'vitest';
import { cropResult, exportFits } from './export';
import { validOutputRect } from './geometry';
import { inlineExecutor } from './jobs';
import { commonCrop, stackWith, type Sources } from './stack';
import type { Bin, Mat3, Rect, StackRequest, StackResult } from './types';

// Two synthetic 64×48 frames on a smooth gradient. f1 is the reference; f2 is shifted by (dx, dy) native pixels,
// so H2 = translate(dx, dy) maps canonical (= f1) coordinates to f2's sensor. A third, East-side frame is
// rotated 180° by the pier flip. The output rect is the whole reference frame, so each frame's edge cuts into it.
const W = 64, H = 48;
const translate = (dx: number, dy: number): Mat3 => [1, 0, dx, 0, 1, dy, 0, 0, 1];
const norm = { median_dn: 100, bwmv_dn: 4, madn_dn: 2 };
function frameData() {
  const d = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d[y * W + x] = 100 + 0.5 * x + 0.25 * y;
  return d;
}
const data = frameData();
function makeSources(frames: Record<string, { H: Mat3; east?: boolean }>): Sources {
  return {
    frame(id) { const f = frames[id]; return { id, width: W, height: H, H: f.H, east: !!f.east }; },
    norm: () => norm,
    fV: () => 1,
    async fetch(_id, rect, bin) {
      const w = rect.w / bin, h = rect.h / bin;
      const out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = data[(rect.y / bin + y) * W + rect.x / bin + x];
      return { data: out, rect, w, h };
    },
  };
}
const req = (frames: string[], bin: Bin = 1, extra: Partial<StackRequest> = {}): StackRequest => ({
  grid: { ref: 'f1', x: 0, y: 0, w: W, h: H, bin }, frames,
  calibration: { bias: false, dark: false, darkFlat: false, flat: null }, algorithm: { name: 'average' }, ...extra,
});

/** Bounding rect of the finite samples of a single-frame stack, i.e. what that frame actually filled. */
function finiteBounds(r: StackResult): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.data[y * r.w + x] === r.data[y * r.w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function allFinite(r: StackResult, c: Rect): boolean {
  for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) if (r.data[y * r.w + x] !== r.data[y * r.w + x]) return false;
  return true;
}

describe('commonCrop: the rectangle every frame contributes to', () => {
  it('two frames offset by a known shift', async () => {
    const dx = 5, dy = -3; // f2's sensor = canonical + (5, −3): f2 has no data for the last 5 columns and the first 3 rows of f1
    const sources = makeSources({ f1: { H: translate(0, 0) }, f2: { H: translate(dx, dy) } });
    const c = commonCrop(req(['f1', 'f2']), sources)!;
    expect(c).toEqual({ x: 0, y: 3, w: W - dx, h: H - 3 });
    // and it is exactly the finite region of f2 alone, which is where the stack has both samples
    const f2 = await stackWith(req(['f2']), sources, inlineExecutor);
    expect(finiteBounds(f2)).toEqual(c);
    expect(allFinite(f2, c)).toBe(true);
  });
  it('is the whole grid for the reference alone, and null for an unrelated frame', () => {
    const sources = makeSources({ f1: { H: translate(0, 0) }, far: { H: translate(1000, 0) } });
    expect(commonCrop(req(['f1']), sources)).toEqual({ x: 0, y: 0, w: W, h: H });
    expect(commonCrop(req(['f1', 'far']), sources)).toBeNull();
  });
  it('an East frame (180° pier flip) and a bin-2 grid agree with the finite samples', async () => {
    // East frame: H maps canonical (u,v) → (W−1−u+2, H−1−v−4): a flip plus a shift; with align, its contribution
    // on the reference grid is a shifted copy, and the crop has to follow the shift on the far side.
    const HE: Mat3 = [-1, 0, W - 1 + 2, 0, -1, H - 1 - 4, 0, 0, 1];
    const sources = makeSources({ f1: { H: translate(0, 0) }, e: { H: HE, east: true } });
    for (const bin of [1, 2] as const) {
      const r = req(['f1', 'e'], bin);
      const c = commonCrop(r, sources)!;
      const e = await stackWith({ ...r, frames: ['e'] }, sources, inlineExecutor);
      const fb = finiteBounds(e);
      // the geometric crop never claims a sample the warp did not fill, and misses at most one sample per side
      expect(allFinite(e, c)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(fb.x); expect(c.x).toBeLessThanOrEqual(fb.x + 1);
      expect(c.y).toBeGreaterThanOrEqual(fb.y); expect(c.y).toBeLessThanOrEqual(fb.y + 1);
      expect(c.x + c.w).toBeLessThanOrEqual(fb.x + fb.w); expect(c.x + c.w).toBeGreaterThanOrEqual(fb.x + fb.w - 1);
      expect(c.y + c.h).toBeLessThanOrEqual(fb.y + fb.h); expect(c.y + c.h).toBeGreaterThanOrEqual(fb.y + fb.h - 1);
    }
  });
  it('a real-data homography: crop lies inside the finite region of the warped frame', async () => {
    const Hs: Mat3 = [0.99982, -0.00005, -2.71, 0.00018, 0.99964, 3.0, 2.6e-8, 3.0e-9, 1]; // f00-like, scaled down
    const sources = makeSources({ f1: { H: translate(0, 0) }, s: { H: Hs } });
    const r = req(['f1', 's']);
    const c = commonCrop(r, sources)!;
    const s = await stackWith({ ...r, frames: ['s'] }, sources, inlineExecutor);
    expect(allFinite(s, c)).toBe(true);
    const fb = finiteBounds(s);
    expect(c.w).toBeGreaterThanOrEqual(fb.w - 2); expect(c.h).toBeGreaterThanOrEqual(fb.h - 2);
  });
  it('accepts a Manifest', () => {
    const manifest = { reference: 'f1', pixel_scale_arcsec: 1, assets: {
      f1: { id: 'f1', kind: 'light' as const, width: W, height: H, dtype: 'u16' as const, files: {}, pier_side: 'West' as const, H: translate(0, 0) },
      f2: { id: 'f2', kind: 'light' as const, width: W, height: H, dtype: 'u16' as const, files: {}, pier_side: 'West' as const, H: translate(-4, 2) },
    } };
    expect(commonCrop(req(['f1', 'f2']), manifest)).toEqual({ x: 4, y: 0, w: W - 4, h: H - 2 });
  });
  it('validOutputRect shrinks to interior samples and clips to the output rect', () => {
    const I: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    expect(validOutputRect(I, 10, 8, { x: 0, y: 0, w: 10, h: 8 })).toEqual({ x: 0, y: 0, w: 10, h: 8 }); // corners on integers are valid samples
    expect(validOutputRect(I, 10, 8, { x: 2, y: 2, w: 20, h: 20 })).toEqual({ x: 2, y: 2, w: 8, h: 6 }); // clipped to both
    expect(validOutputRect(translate(0.5, 0.5), 10, 8, { x: 0, y: 0, w: 10, h: 8 })).toEqual({ x: 0, y: 0, w: 9, h: 7 }); // sample 9 maps to 9.5 > 9
    expect(validOutputRect(translate(50, 0), 10, 8, { x: 0, y: 0, w: 10, h: 8 })).toBeNull();
  });
});

describe('cropped export', () => {
  const res: StackResult = { data: Float32Array.from({ length: 6 * 4 }, (_, i) => i), w: 6, h: 4, noise: 1, ms: 0 };
  it('cropResult copies the sub-rectangle and keeps the whole result when the crop is the whole', () => {
    const c = cropResult(res, { x: 1, y: 1, w: 3, h: 2 });
    expect(c.w).toBe(3); expect(c.h).toBe(2);
    expect(Array.from(c.data)).toEqual([7, 8, 9, 13, 14, 15]);
    expect(cropResult(res, { x: 0, y: 0, w: 6, h: 4 })).toBe(res);
    expect(() => cropResult(res, { x: 4, y: 0, w: 3, h: 1 })).toThrow();
  });
  it('exportFits honours the crop in NAXIS and writes the bottom row first', async () => {
    const blob = exportFits(res, { IMAGETYP: 'Master Light' }, { crop: { x: 1, y: 1, w: 3, h: 2 } });
    const buf = new Uint8Array(await blob.arrayBuffer());
    const head = new TextDecoder().decode(buf.subarray(0, 2880));
    expect(head).toMatch(/NAXIS1  = +3/); expect(head).toMatch(/NAXIS2  = +2/);
    const dv = new DataView(buf.buffer, 2880);
    expect(dv.getFloat32(0, false) * 65535).toBeCloseTo(13, 3); // first FITS row = last image row of the crop
    expect(exportFits(res, {}).size).toBe(2880 * 2); // uncropped still works
  });
});
