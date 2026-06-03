import { test, expect } from '@playwright/test';

test.use({ trace: 'on-first-retry' });

test('DEBUG: Inspect Confirm Split Dialog', async ({ page }) => {
  // Login
  await page.goto('http://172.168.50.94/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  const emailInput = page.locator('input[placeholder="Email"]');
  await emailInput.fill('shalini.bharadwaj@provana.com');
  
  const passwordInput = page.locator('input[placeholder="Password"]');
  await passwordInput.fill('March@@@2026');
  
  const loginButton = page.locator('button:has-text("Login")');
  await loginButton.click();
  
  await page.waitForURL('**/file-inbox**', { timeout: 15000 });
  await page.goto('http://172.168.50.94/queue/file-inbox?process=6', { waitUntil: 'networkidle' });
  
  // Select process dropdown
  const processDropdown = page.locator('mat-select, select').first();
  await processDropdown.click();
  await page.waitForTimeout(800);
  
  const groupingOption = page.locator('mat-option, [role="option"]').filter({ hasText: /Grouping|grouping/ }).first();
  await groupingOption.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click on first file
  const inboxFiles = page.locator('[class*="inbox"], [class*="left-panel"], [class*="file-list"], tbody tr');
  const firstFile = inboxFiles.nth(0);
  await firstFile.click({ force: true });
  
  // Click Split button
  await page.waitForTimeout(5000);
  const splitButton = page.frameLocator('iframe').locator('button:has-text("Split")').first();
  if (await splitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await splitButton.click();
    console.log('✓ Split button clicked');
  }
  
  // Wait and inspect what appears
  await page.waitForTimeout(3000);
  
  // Log all visible buttons on the page
  const allButtons = await page.locator('button').all();
  console.log(`\n=== TOTAL BUTTONS ON MAIN PAGE: ${allButtons.length} ===`);
  
  for (let i = 0; i < allButtons.length; i++) {
    const buttonText = await allButtons[i].textContent();
    const isVisible = await allButtons[i].isVisible().catch(() => false);
    console.log(`Button ${i + 1}: "${buttonText?.trim()}" | Visible: ${isVisible}`);
  }
  
  // Check buttons INSIDE IFRAME
  console.log(`\n=== BUTTONS IN IFRAME ===`);
  const iframeLocator = page.frameLocator('iframe');
  const iframeButtons = await iframeLocator.locator('button').all();
  console.log(`Buttons found in iframe: ${iframeButtons.length}`);
  
  for (let i = 0; i < iframeButtons.length; i++) {
    const buttonText = await iframeButtons[i].textContent();
    const isVisible = await iframeButtons[i].isVisible().catch(() => false);
    const className = await iframeButtons[i].getAttribute('class');
    console.log(`Iframe Button ${i + 1}: "${buttonText?.trim()}" | Visible: ${isVisible} | Class: ${className}`);
  }
  
  // Check for any dialogs/modals in iframe
  console.log(`\n=== ALL TEXT IN IFRAME (first 1000 chars) ===`);
  const iframeContent = await page.frameLocator('iframe').locator('body').textContent();
  console.log(iframeContent?.substring(0, 1000) || "No content");
  
  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png' });
  console.log('Screenshot saved: debug-screenshot.png');
});
