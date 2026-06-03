import { test, expect } from '@playwright/test';

test('Valid Login Test', async ({ page }) => {

  await page.goto('/');

  await page.locator('input[name="username"]').fill('Admin');

  await page.locator('input[name="password"]').fill('admin123');

  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/dashboard/);
});