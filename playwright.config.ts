import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 30000, retries: 0, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173/Spilink/', browserName: 'chromium', locale: 'ko-KR', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: { env: { BASE_PATH: '/Spilink' }, command: 'npm run preview -- --port 4173', url: 'http://127.0.0.1:4173/Spilink/', reuseExistingServer: !process.env.CI, timeout: 60000 }
});
