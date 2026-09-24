/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/data': 'http://localhost:8080',
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.js', 'server/**/*.test.ts'],
  },
});
