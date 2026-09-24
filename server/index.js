// Fastify server: serves dist/ and the ONE api, GET /api/roi (SPEC §4.3, docs/contracts.md).
// Owner: Data + server. No processing logic lives here: it streams rows out of the
// precomputed pixel files (tools/precompute/runtime.py) with positioned reads.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = process.env.ASTRO_DATA ?? path.resolve(__dirname, '..', 'data', 'derived', 'runtime');
const DEFAULT_DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT ?? 8080);

const BINS = new Set([1, 2, 4, 8]);
const BYTES = { u16: 2, f32: 4 };
/** Target bytes per positioned read: a few MB keeps memory flat and syscalls few. */
const READ_TARGET_BYTES = 4 << 20;

class RoiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Parse one optional non-negative integer query parameter. */
function intParam(query, name) {
  const raw = query[name];
  if (raw === undefined || raw === '') return undefined;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new RoiError(400, `${name} must be a non-negative integer`);
  const v = Number(raw);
  if (!Number.isSafeInteger(v)) throw new RoiError(400, `${name} is out of range`);
  return v;
}

/**
 * Validate and clamp an ROI request against an asset (pure, unit-tested).
 * Returns the bin-1 rectangle actually served plus the sample geometry of the bin file.
 */
export function resolveRoi(asset, query) {
  const bin = intParam(query, 'bin') ?? 1;
  if (!BINS.has(bin)) throw new RoiError(400, 'bin must be one of 1, 2, 4, 8');
  const W = asset.width;
  const H = asset.height;
  // Bin files hold floor(W/bin) x floor(H/bin) samples: omitted w/h default to that
  // extent, and the rect is clamped to it, so every value stays a multiple of bin and
  // every requested sample exists in the file.
  const fileW = Math.floor(W / bin);
  const fileH = Math.floor(H / bin);
  const maxX = fileW * bin;
  const maxY = fileH * bin;
  const x = intParam(query, 'x') ?? 0;
  const y = intParam(query, 'y') ?? 0;
  const w = intParam(query, 'w') ?? maxX - x;
  const h = intParam(query, 'h') ?? maxY - y;
  if (w <= 0 || h <= 0) throw new RoiError(400, 'w and h must be positive');
  if (bin > 1) {
    for (const [name, v] of [['x', x], ['y', y], ['w', w], ['h', h]]) {
      if (v % bin !== 0) throw new RoiError(400, `${name} must be a multiple of bin`);
    }
  }
  if (x >= maxX || y >= maxY) throw new RoiError(400, 'rectangle lies outside the image');
  const cw = Math.min(w, maxX - x);
  const ch = Math.min(h, maxY - y);
  const dtype = bin === 1 ? asset.dtype : 'f32';
  return {
    bin,
    rect: { x, y, w: cw, h: ch },
    file: asset.files[String(bin)],
    fileW,
    fileH,
    dtype,
    bytesPerSample: BYTES[dtype],
    sx: x / bin,
    sy: y / bin,
    sw: cw / bin,
    sh: ch / bin,
  };
}

/**
 * Stream the rows of a resolved ROI from its pixel file, a block of rows per read.
 * Only the requested columns are pushed; the file is never loaded whole.
 */
export function roiStream(filePath, r) {
  const rowBytes = r.fileW * r.bytesPerSample;
  const outRowBytes = r.sw * r.bytesPerSample;
  const rowsPerBlock = Math.max(1, Math.floor(READ_TARGET_BYTES / rowBytes));
  const fullWidth = r.sx === 0 && r.sw === r.fileW;

  async function* rows() {
    const fh = await fsp.open(filePath, 'r');
    try {
      for (let row = 0; row < r.sh; row += rowsPerBlock) {
        const n = Math.min(rowsPerBlock, r.sh - row);
        const pos = (r.sy + row) * rowBytes + (fullWidth ? 0 : r.sx * r.bytesPerSample);
        if (fullWidth) {
          const buf = Buffer.allocUnsafe(n * rowBytes);
          const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
          if (bytesRead !== buf.length) throw new Error(`short read in ${filePath}`);
          yield buf;
        } else {
          // read the spanning region once, then pack the wanted columns of each row
          const span = (n - 1) * rowBytes + outRowBytes;
          const buf = Buffer.allocUnsafe(span);
          const { bytesRead } = await fh.read(buf, 0, span, pos);
          if (bytesRead !== span) throw new Error(`short read in ${filePath}`);
          const out = Buffer.allocUnsafe(n * outRowBytes);
          for (let i = 0; i < n; i++) buf.copy(out, i * outRowBytes, i * rowBytes, i * rowBytes + outRowBytes);
          yield out;
        }
      }
    } finally {
      await fh.close();
    }
  }
  return Readable.from(rows(), { objectMode: false });
}

export async function buildServer({ dataDir = DEFAULT_DATA_DIR, distDir = DEFAULT_DIST_DIR, logger = false } = {}) {
  const app = Fastify({ logger });
  const hasDist = fs.existsSync(distDir);
  if (hasDist) {
    await app.register(fastifyStatic, { root: distDir, prefix: '/', decorateReply: true });
  }
  if (fs.existsSync(dataDir)) {
    await app.register(fastifyStatic, {
      root: dataDir,
      prefix: '/data/',
      decorateReply: false,
      allowedPath: (p) => p.endsWith('.json'),
      cacheControl: false,
      setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
    });
  }

  let manifestPromise = null;
  const manifest = () => {
    manifestPromise ??= fsp.readFile(path.join(dataDir, 'manifest.json'), 'utf8').then(JSON.parse);
    return manifestPromise;
  };

  app.get('/api/roi', async (req, reply) => {
    const q = req.query ?? {};
    let m;
    try {
      m = await manifest();
    } catch (e) {
      manifestPromise = null;
      return reply.code(503).send({ error: `manifest.json not available: ${e.message}` });
    }
    const id = typeof q.id === 'string' ? q.id : undefined;
    if (!id) return reply.code(400).send({ error: 'id is required' });
    const asset = m.assets?.[id];
    if (!asset) return reply.code(404).send({ error: `unknown asset id: ${id}` });
    let r;
    try {
      r = resolveRoi(asset, q);
    } catch (e) {
      if (e instanceof RoiError) return reply.code(e.status).send({ error: e.message });
      throw e;
    }
    const filePath = path.join(dataDir, r.file);
    try {
      await fsp.access(filePath, fs.constants.R_OK);
    } catch {
      return reply.code(404).send({ error: `pixel file missing for ${id} at bin ${r.bin}` });
    }
    reply
      .header('X-Roi', `${r.rect.x},${r.rect.y},${r.rect.w},${r.rect.h}`)
      .header('X-Width', String(r.sw))
      .header('X-Height', String(r.sh))
      .header('X-Dtype', r.dtype)
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', String(r.sw * r.sh * r.bytesPerSample))
      .header('Cache-Control', 'no-store')
      .header('Access-Control-Expose-Headers', 'X-Roi, X-Width, X-Height, X-Dtype');
    return reply.send(roiStream(filePath, r));
  });

  // SPA fallback: any unknown non-API, non-data path gets index.html (hash routes live client-side).
  app.setNotFoundHandler((req, reply) => {
    const url = req.raw.url ?? '';
    if (req.method === 'GET' && hasDist && !url.startsWith('/api/') && !url.startsWith('/data/')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`listening on :${PORT}, data from ${DEFAULT_DATA_DIR}`);
}
