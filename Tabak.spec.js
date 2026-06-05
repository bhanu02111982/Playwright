import { test, expect } from '@playwright/test';

const BASE_URL = 'http://172.168.50.94';
const USER_EMAIL = 'shalini.bharadwaj@provana.com';
const USER_PASSWORD = 'March@@@2026';
const PROCESS_URL = {
  Grouping: `${BASE_URL}/queue/file-inbox?process=6`,
  Classification: `${BASE_URL}/queue/file-inbox?process=7`,
};

const SELECTORS = {
  processDropdown: 'mat-form-field:has-text("Process") button, mat-form-field:has-text("Process") mat-select, button:has-text("Process"), [aria-label="Process"]',
  processOption: (name) => `mat-option:has-text("${name}"), [role="option"]:has-text("${name}"), div[role="option"]:has-text("${name}")`,
  fileRows: 'table tbody tr, .file-row, .mat-row, .cdk-row',
  splitButton: 'button:has-text("Split"), button:has-text("split"), [role="button"]:has-text("Split"), div:has-text("Split"), span:has-text("Split")',
  confirmSplitButton: 'button:has-text("Confirm Split"), button:has-text("Confirm split"), [role="button"]:has-text("Confirm Split"), div:has-text("Confirm Split"), span:has-text("Confirm Split")',
  queryDropdown: 'mat-form-field:has-text("Query item"), mat-form-field:has-text("Select query item(s)"), mat-form-field:has-text("Select query item"), mat-select:has-text("Select query item(s)"), mat-select:has-text("Select query item"), mat-select:has-text("Query item"), button:has-text("Select query item(s)"), button:has-text("Select query item"), button:has-text("Query item"), [aria-label*="query item"], div:has-text("Select query item(s)"), div:has-text("Select query item"), span:has-text("Select query item"), span:has-text("Query item"), [role="combobox"]:has-text("Query item")',
  queryOption: 'mat-option, [role="option"], li',
  addToQueryButton: 'button:has-text("Add to query"), button:has-text("Add to Query"), [role="button"]:has-text("Add to query")',
};

async function login(page) {
  await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder('Email').fill(USER_EMAIL);
  await expect(page.getByPlaceholder('Password')).toBeVisible({ timeout: 15000 });
  await page.getByPlaceholder('Password').fill(USER_PASSWORD);
  await Promise.all([
    page.waitForURL('**/file-inbox**', { timeout: 20000 }),
    page.getByRole('button', { name: /login/i }).click(),
  ]);
  await expect(page).toHaveURL(/file-inbox/);
}

function getFileRowLocator(page) {
  return page.locator(SELECTORS.fileRows).filter({ has: page.locator('td, .mat-cell, .cdk-cell') });
}

async function getFileLabels(page) {
  const rows = getFileRowLocator(page);
  return rows.allTextContents();
}

async function selectProcess(page, processName) {
  const dropdown = page.locator(SELECTORS.processDropdown).first();
  const dropdownVisible = await dropdown.isVisible().catch(() => false);

  if (dropdownVisible) {
    await dropdown.click();
    const option = page.locator(SELECTORS.processOption(processName)).first();
    await expect(option).toBeVisible({ timeout: 10000 });
    await option.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    return;
  }

  const url = PROCESS_URL[processName];
  if (!url) {
    throw new Error(`No process URL defined for ${processName}`);
  }
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
}

async function findVisibleLocator(page, selectors) {
  const selectorList = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorList) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  }

  for (const selector of selectorList) {
    const locator = page.frameLocator('iframe').locator(selector).first();
    if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
      return locator;
    }
  }

  return null;
}

async function processGroupingFiles(page) {
  const fileLabels = await getFileLabels(page);
  expect(fileLabels.length).toBeGreaterThan(1);

  for (const label of fileLabels) {
    const fileRow = getFileRowLocator(page).filter({ hasText: label }).first();
    await expect(fileRow).toBeVisible({ timeout: 10000 });
    await fileRow.scrollIntoViewIfNeeded();
    await fileRow.click({ force: true });
    await page.waitForTimeout(1500);

    const splitButton = await findVisibleLocator(page, SELECTORS.splitButton);
    if (!splitButton) {
      return false;
    }
    await expect(splitButton).toBeVisible({ timeout: 10000 });
    await splitButton.click();

    const confirmSplitButton = await findVisibleLocator(page, SELECTORS.confirmSplitButton);
    if (!confirmSplitButton) {
      return false;
    }
    await expect(confirmSplitButton).toBeVisible({ timeout: 10000 });
    await confirmSplitButton.click();

    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/file-inbox/);
  }
  return true;
}

async function openQueryDropdown(page) {
  const dropdown = await findVisibleLocator(page, SELECTORS.queryDropdown);
  if (!dropdown) {
    throw new Error('Select query item(s) dropdown not found');
  }
  await expect(dropdown).toBeVisible({ timeout: 10000 });
  await dropdown.click();
  await page.waitForTimeout(800);
}

async function selectFirstQueryOption(page) {
  const option = await findVisibleLocator(page, SELECTORS.queryOption);
  if (!option) {
    throw new Error('No query option visible');
  }
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

async function clickAddToQuery(page) {
  const button = await findVisibleLocator(page, SELECTORS.addToQueryButton);
  if (!button) {
    throw new Error('Add to Query button not found');
  }
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();
}

async function processClassificationFiles(page) {
  const fileLabels = await getFileLabels(page);
  expect(fileLabels.length).toBeGreaterThan(0);

  for (const label of fileLabels) {
    const fileRow = await getFileRowLocator(page).filter({ hasText: label }).first();
    await expect(fileRow).toBeVisible({ timeout: 10000 });
    await fileRow.click({ force: true });
    await page.waitForTimeout(1200);

    await openQueryDropdown(page);
    await selectFirstQueryOption(page);
    await clickAddToQuery(page);
    await page.waitForTimeout(1500);
  }
}

test.describe('Tabak dynamic Grouping and Classification flow', () => {
  test('handles grouping and classification based on file count', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    await login(page);
    await expect(page.getByRole('heading', { name: /File Inbox/i })).toBeVisible({ timeout: 15000 });

    await selectProcess(page, 'Grouping');
    const fileCount = await getFileRowLocator(page).count();

    if (fileCount > 1) {
      const groupingSuccess = await processGroupingFiles(page);
      if (!groupingSuccess) {
        await selectProcess(page, 'Classification');
        const classificationCount = await getFileRowLocator(page).count();
        expect(classificationCount).toBeGreaterThan(0);
        await processClassificationFiles(page);
      }
    } else {
      await selectProcess(page, 'Classification');
      const classificationCount = await getFileRowLocator(page).count();
      expect(classificationCount).toBeGreaterThan(0);
      await processClassificationFiles(page);
    }
  });
});
