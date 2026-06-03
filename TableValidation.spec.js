import { test, expect } from '@playwright/test';

test('Validate Table Data', async ({ page }) => {

  await page.goto('https://the-internet.herokuapp.com/tables');

  const rowText = await page.locator('table#table1 tbody tr').nth(0).textContent();

  expect(rowText).toContain('Smith');
});