import { test, expect } from '@playwright/test';

test.use({ trace: 'on-first-retry' });

test('Claims Process - Login and Navigate to File Inbox', async ({ page }) => {
  // Navigate to application
  await page.goto('http://172.168.50.94/', {
    waitUntil: 'networkidle'
  });

  // Wait for page to load
  await page.waitForTimeout(1500);

  // Check if login form exists
  const loginForm = page.locator('form');
  await expect(loginForm).toBeVisible({ timeout: 10000 });

  // Fill in email
  const emailInput = page.locator('input[placeholder="Email"]');
  await emailInput.fill('shalini.bharadwaj@provana.com');
  console.log('✓ Email entered: shalini.bharadwaj@provana.com');

  // Fill in password
  const passwordInput = page.locator('input[placeholder="Password"]');
  await passwordInput.fill('March@@@2026');
  console.log('✓ Password entered');

  // Click login button
  const loginButton = page.locator('button:has-text("Login")');
  await loginButton.click();
  console.log('✓ Login button clicked');

  // Wait for login to complete and redirect
  await page.waitForURL('**/file-inbox**', { timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('✓ Successfully navigated to File Inbox');

  // Check if the page loaded successfully
  const pageTitle = await page.title();
  console.log(`✓ Page Title: ${pageTitle}`);
  expect(pageTitle).toBeTruthy();

  // Take screenshot after login
  await page.screenshot({ path: 'claims-after-login.png' });

});
