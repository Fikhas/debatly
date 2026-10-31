import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    }
  },
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    env: { PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '' },
    timeout: 60000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
