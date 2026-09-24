/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const api = `http://localhost:${process.env.VITE_API_PORT ?? '8080'}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/data': api,
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.js', 'server/**/*.test.ts'],
  },
});
