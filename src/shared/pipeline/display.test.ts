import { describe, expect, it } from 'vitest';
import { difference, differenceRange, rotate180, toRgba } from './display';
import { exportFilename, exportFits, fitsHeaderFor } from './export';
import { ByteLru } from '../data/lru';
import { decodeRoiBody, parseRoiHeaders, roiKey, roiUrl } from '../data/roi';

describe('display', () => {
  it('NaN → stage colour, linear range and rotation', () => {
    const d = new Float32Array([NaN, 0, 50, 100]);
    const px = toRgba(d, 2, 2, { linearLo: 0, linearHi: 100 });
    expect([px[0], px[1], px[2], px[3]]).toEqual([0x0f, 0x12, 0x20, 255]);
    expect(px[4]).toBe(0); expect(px[8]).toBe(128); expect(px[12]).toBe(255);
    const r = toRgba(d, 2, 2, { linearLo: 0, linearHi: 100 }, { rotate180: true });
    expect(r[0]).toBe(255); expect(r[12]).toBe(0x0f);
    expect(Array.from(rotate180(new Float32Array([1, 2, 3])))).toEqual([3, 2, 1]);
  });
  it('difference centres on mid grey', () => {
    const d = difference(new Float32Array([10, 20, NaN]), new Float32Array([10, 15, 1]));
    expect(d[0]).toBe(32767.5); expect(d[1]).toBe(32772.5); expect(Number.isNaN(d[2])).toBe(true);
    const r = differenceRange(d);
    expect(r.linearLo).toBeLessThan(32767.5); expect(r.linearHi).toBeGreaterThan(32767.5);
  });
});

describe('export', () => {
  const req = { grid: { ref: 'f03', x: 0, y: 0, w: 4, h: 2, bin: 1 as const }, frames: ['f00', 'f01', 'f00'], calibration: { bias: true, dark: true, darkFlat: false, flat: 50 as const }, algorithm: { name: 'winsorized' as const } };
  const result = { data: new Float32Array([0, 65535, NaN, 32767.5, 1, 2, 3, 4]), w: 4, h: 2, noise: 12, ms: 1 };
  it('filename encodes the settings', () => {
    expect(exportFilename(req, 'fits')).toBe('ngc7331_stack_2f_winsorized_dark-flat_50_bias.fits');
  });
  it('FITS is 2880-byte blocks, BITPIX −32, NaN → 0, rows bottom-up', async () => {
    const blob = exportFits(result, fitsHeaderFor(req, result));
    expect(blob.size % 2880).toBe(0);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const head = new TextDecoder().decode(buf.subarray(0, 2880));
    expect(head.startsWith('SIMPLE  =                    T')).toBe(true);
    expect(head).toContain('BITPIX  =                  -32');
    expect(head).toContain("IMAGETYP= 'Master Light'");
    expect(head).toContain('NCOMBINE=                    2');
    expect(head).toContain('TOTEXP  =                  600');
    expect(head).toContain("CALIB   = 'dark|flat_50_bias'");
    expect(head).toContain('ALG_CUTO=');
    expect(head).toContain('END');
    const dv = new DataView(buf.buffer, 2880);
    expect(dv.getFloat32(0, false)).toBeCloseTo(1 / 65535, 9); // first file row = last image row
    expect(dv.getFloat32(16, false)).toBe(0);
    expect(dv.getFloat32(20, false)).toBe(1);
    expect(dv.getFloat32(24, false)).toBe(0); // NaN → 0
  });
});

describe('data layer', () => {
  it('ByteLru evicts least recently used by bytes', () => {
    const c = new ByteLru<number>(10);
    c.set('a', 1, 4); c.set('b', 2, 4); c.get('a'); c.set('c', 3, 4);
    expect(c.has('a')).toBe(true); expect(c.has('b')).toBe(false); expect(c.bytes).toBe(8);
    c.set('big', 9, 11); expect(c.has('big')).toBe(false);
  });
  it('roi url, key and header parsing', () => {
    expect(roiUrl('f03', { x: 2, y: 4, w: 8, h: 6 }, 2)).toBe('/api/roi?id=f03&bin=2&x=2&y=4&w=8&h=6');
    expect(roiUrl('bias', null, 1)).toBe('/api/roi?id=bias&bin=1');
    expect(roiKey('f03', null, 4)).toBe('f03|all|4');
    const h = new Map([['X-Roi', '2,4,8,6'], ['X-Width', '4'], ['X-Height', '3'], ['X-Dtype', 'u16']]);
    const m = parseRoiHeaders({ get: (k) => h.get(k) ?? null });
    expect(m).toEqual({ rect: { x: 2, y: 4, w: 8, h: 6 }, w: 4, h: 3, dtype: 'u16' });
    const u = new Uint16Array([1, 65535, 7]);
    expect(Array.from(decodeRoiBody(u.buffer, 'u16', 3))).toEqual([1, 65535, 7]);
  });
});
