import { test, expect } from '@playwright/test';

const USER_EMAIL = 'shalini.bharadwaj@provana.com';
const USER_PASSWORD = 'March@@@2026';
const BASE_URL = 'http://172.168.50.94';
const GROUPING_QUEUE_URL = `${BASE_URL}/queue/file-inbox?process=6`;
const PROCESS_URL_MAP = {
  Grouping: `${BASE_URL}/queue/file-inbox?process=6`,
  Classification: `${BASE_URL}/queue/file-inbox?process=7`,
};

const selectors = {
  loginForm: 'form',
  emailInput: 'input[placeholder="Email"], input[name="email"], input[type="email"]',
  passwordInput: 'input[placeholder="Password"], input[name="password"], input[type="password"]',
  loginButton: 'button:has-text("Login"), input[type="submit"][value="Login"]',
  processDropdown: 'mat-form-field:has-text("Process") mat-select, mat-select[aria-label="Process"], button:has-text("Process"), [aria-label="Process"]',
  processOption: (name) => `mat-option:has-text("${name}"), [role="option"]:has-text("${name}")`,
  fileRow: 'table tbody tr, .file-row, .mat-row, .cdk-row, [role="row"]',
  queryDropdown: 'mat-form-field:has-text("Query item") mat-select, mat-select:has-text("Select query item(s)"), mat-select:has-text("Select query item"), button:has-text("Select query item(s)"), button:has-text("Select query item"), [aria-label*="query item"], div:has-text("Select query item"), span:has-text("Select query item")',
  queryOption: 'mat-option, [role="option"], li',
  addToQueryButton: 'button:has-text("Add to query"), button:has-text("Add to Query"), a:has-text("Add to query"), a:has-text("Add to Query")',
  saveButton: 'button:has-text("Save"), a:has-text("Save"), input[type="submit"][value="Save"], input[type="button"][value="Save"]',
};

async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await expect(page.locator(selectors.loginForm)).toBeVisible({ timeout: 15000 });
  await page.fill(selectors.emailInput, USER_EMAIL);
  await page.fill(selectors.passwordInput, USER_PASSWORD);
  await Promise.all([
    page.waitForURL('**/file-inbox**', { timeout: 20000 }),
    page.click(selectors.loginButton),
  ]);
  await expect(page).toHaveURL(/file-inbox/);
}

async function selectProcess(page, processName) {
  const dropdown = page.locator(selectors.processDropdown).first();
  const dropdownVisible = await dropdown.isVisible().catch(() => false);
  if (dropdownVisible) {
    await dropdown.click();
    const option = page.locator(selectors.processOption(processName)).first();
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
    await page.waitForLoadState('networkidle');
    return;
  }

  const fallbackUrl = PROCESS_URL_MAP[processName];
  if (!fallbackUrl) {
    throw new Error(`Process selector not available and no fallback URL defined for ${processName}`);
  }
  await page.goto(fallbackUrl, { waitUntil: 'networkidle', timeout: 20000 });
}

async function clickFirstVisible(page, selector) {
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible({ timeout: 10000 });
  await locator.click({ force: true });
}

async function selectFirstQueryItem(page) {
  const dropdown = page.locator(selectors.queryDropdown).first();
  await expect(dropdown).toBeVisible({ timeout: 10000 });
  await dropdown.click();
  const option = page.locator(selectors.queryOption).first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

async function addToQuery(page) {
  await clickFirstVisible(page, selectors.addToQueryButton);
}

async function saveChanges(page) {
  await clickFirstVisible(page, selectors.saveButton);
}

async function hasFileRows(page) {
  return await page.locator(selectors.fileRow).count() > 0;
}

async function selectFirstFile(page) {
  const firstFile = page.locator(selectors.fileRow).first();
  await expect(firstFile).toBeVisible({ timeout: 10000 });
  await firstFile.click({ force: true });
}

test.describe('Tabak High Priority Automation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(GROUPING_QUEUE_URL, { waitUntil: 'networkidle' });
  });

  test('High Priority: Login and open file inbox queue', async ({ page }) => {
    await expect(page).toHaveURL(/process=6/);
    await expect(page.locator('h3:has-text("File Inbox")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(selectors.fileRow).first()).toBeVisible({ timeout: 15000 });
  });

  test('High Priority: fallback to Classification when Grouping has no records', async ({ page }) => {
    await selectProcess(page, 'Grouping');
    const groupHasFiles = await hasFileRows(page);
    if (!groupHasFiles) {
      await selectProcess(page, 'Classification');
      await expect(page).toHaveURL(/process=.*Classification|process=.*classification|process=7|process=8/);
      await selectFirstFile(page);
    } else {
      test.skip('Grouping contains files; classification fallback not required');
    }
  });

  test('High Priority: select first classification file, add to query, and save', async ({ page }) => {
    await selectProcess(page, 'Classification');
    await expect(page.locator(selectors.fileRow).first()).toBeVisible({ timeout: 15000 });
    await selectFirstFile(page);
    await selectFirstQueryItem(page);
    await addToQuery(page);
    await saveChanges(page);
    await expect(page).toHaveURL(/file-inbox|queue\/file-inbox/);
  });
});
