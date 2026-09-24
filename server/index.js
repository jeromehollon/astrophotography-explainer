// Fastify server: serves dist/ and the ONE api, GET /api/roi (SPEC §4.3). Owner: Data + server.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ASTRO_DATA ?? path.resolve(__dirname, '..', 'data', 'derived', 'runtime');
const PORT = Number(process.env.PORT ?? 8080);

export async function buildServer() {
  const app = Fastify({ logger: false });
  await app.register(fastifyStatic, { root: path.resolve(__dirname, '..', 'dist'), prefix: '/', decorateReply: true });
  await app.register(fastifyStatic, { root: DATA_DIR, prefix: '/data/', decorateReply: false });
  app.get('/api/roi', async (_req, reply) => reply.code(501).send({ error: 'not implemented' }));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await buildServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`listening on :${PORT}, data from ${DATA_DIR}`);
}
