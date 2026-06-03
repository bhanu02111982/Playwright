import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('File Upload Test', async ({ page }) => {

  await page.goto('https://the-internet.herokuapp.com/upload');

  const filePath = path.resolve(__dirname, '..', 'sample.pdf');
  await page.setInputFiles('#file-upload', filePath);

  await page.click('#file-submit');

  await expect(page.locator('h3'))
    .toHaveText('File Uploaded!');
});