import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 90000, workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  outputDir: 'output/playwright/results',
  use: { baseURL: 'http://127.0.0.1:4175', browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node tools/test-server.mjs', url: 'http://127.0.0.1:4175', env: { PORT: '4175' }, reuseExistingServer: false }
});
