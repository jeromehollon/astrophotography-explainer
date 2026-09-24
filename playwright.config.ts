import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: process.env.E2E_BASE ?? 'http://localhost:5173', viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
