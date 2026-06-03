import { test, expect } from '@playwright/test';
import fs   from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
//  UNATTENDED MODE — changes made for headless / scheduled runs
//  1. Headless browser enforced via playwright.config.js
//  2. Global timeout extended to 10 minutes (long split ops)
//  3. test.setTimeout() set per-test to 30 minutes
//  4. Screenshot on EVERY failure (not just final)
//  5. Retry logic on critical steps (login, page load)
//  6. Auto-dismiss unexpected browser dialogs
//  7. Network error detection with graceful skip
//  8. Exit-code-safe: errors logged, test always completes
//  9. Logger flushes synchronously on process exit (SIGTERM)
// ═══════════════════════════════════════════════════════════════

// ─── LOGGER ────────────────────────────────────────────────────
function createLogger() {
  const logDir  = path.resolve('logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const now      = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const logFile  = path.join(logDir, `Tabak_${datePart}_${timePart}.log`);
  const stream   = fs.createWriteStream(logFile, { flags: 'a' });
  const stats    = { info: 0, warn: 0, error: 0, startTime: Date.now() };

  // Flush log on unexpected process exit (SIGTERM from scheduler)
  process.on('exit',    () => { try { stream.end(); } catch(_){} });
  process.on('SIGTERM', () => { try { stream.end(); } catch(_){} });

  function write(level, message) {
    const ts   = new Date().toISOString();
    const line = `[${ts}] [${level.padEnd(5)}] ${message}`;
    stream.write(line + '\n');
    console.log(line);
    stats[level.toLowerCase()] = (stats[level.toLowerCase()] || 0) + 1;
  }

  return {
    info   : (msg) => write('INFO',  msg),
    warn   : (msg) => write('WARN',  msg),
    error  : (msg) => write('ERROR', msg),
    section: (title) => {
      const bar = '─'.repeat(60);
      const txt = `\n${bar}\n  ${title}\n${bar}`;
      stream.write(txt + '\n');
      console.log(txt);
    },
    summary: (fileCount, errors) => {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
      const lines = [
        '',
        '════════════════════════════════════════════════════════════',
        '  TABAK TEST RUN SUMMARY',
        '════════════════════════════════════════════════════════════',
        `  Log file      : ${logFile}`,
        `  Run date/time : ${now.toLocaleString()}`,
        `  Total files   : ${fileCount}`,
        `  Errors logged : ${errors.length}`,
        `  INFO lines    : ${stats.info}`,
        `  WARN lines    : ${stats.warn}`,
        `  ERROR lines   : ${stats.error}`,
        `  Elapsed       : ${elapsed} s`,
        '',
      ];
      if (errors.length > 0) {
        lines.push('  ── ERROR DETAILS ──────────────────────────────────────');
        errors.forEach((e, i) => lines.push(`  [${i + 1}] ${e}`));
        lines.push('');
      }
      lines.push('  RESULT : ' + (errors.length === 0
        ? '✓ ALL FILES PROCESSED SUCCESSFULLY'
        : '⚠ COMPLETED WITH ERRORS'));
      lines.push('════════════════════════════════════════════════════════════');
      lines.push('');
      const text = lines.join('\n');
      stream.write(text + '\n');
      console.log(text);
      stream.end();
    },
    filePath: logFile,
  };
}

// ─── RETRY HELPER ──────────────────────────────────────────────
// Retries an async function up to maxAttempts times.
// Waits 2 s between attempts. Logs each retry.
async function withRetry(label, fn, logger, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      logger.warn(`${label} — attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ─── TEST ──────────────────────────────────────────────────────
test.use({ trace: 'on-first-retry' });

test('Login and Validate File Grouping and Classification by Process',
  async ({ page }) => {

  // ── Per-test timeout: 30 minutes (unattended long runs) ──────
  test.setTimeout(30 * 60 * 1000);

  const logger   = createLogger();
  const errors   = [];
  let   fileCount = 0;

  function logWarn(msg) { logger.warn(msg); errors.push(msg); }

  // ── Auto-dismiss unexpected dialogs (alerts, confirms, prompts)
  // Without this, an unexpected dialog freezes an unattended run.
  page.on('dialog', async (dialog) => {
    logger.warn(`Unexpected dialog [${dialog.type()}]: "${dialog.message()}" — auto-dismissed`);
    await dialog.dismiss();
  });

  // ── Capture console errors from the browser ───────────────────
  page.on('pageerror', (err) => {
    logger.error(`Browser page error: ${err.message}`);
  });

  logger.section('TEST START — Tabak Grouping & Split Automation (UNATTENDED)');
  logger.info(`Log file : ${logger.filePath}`);
  logger.info(`Run mode : HEADLESS / UNATTENDED`);

  // ─────────────────────────────────────────────────────────────
  //  STEP 1 — NAVIGATE TO APPLICATION
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 1 — Navigate to Tabak Application');

  await withRetry('Navigate to app', async () => {
    await page.goto('http://172.168.50.94/', { waitUntil: 'networkidle', timeout: 30000 });
  }, logger);
  await page.waitForTimeout(1500);
  logger.info(`Page loaded — title: "${await page.title()}"`);

  // ─────────────────────────────────────────────────────────────
  //  STEP 2 — LOGIN
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 2 — Login');

  const loginForm = page.locator('form');
  await expect(loginForm).toBeVisible({ timeout: 10000 });
  logger.info('Login form visible');

  await page.locator('input[placeholder="Email"]').fill('shalini.bharadwaj@provana.com');
  logger.info('Email entered');

  await page.locator('input[placeholder="Password"]').fill('March@@@2026');
  logger.info('Password entered');

  await withRetry('Login click', async () => {
    await page.locator('button:has-text("Login")').click();
    await page.waitForURL('**/file-inbox**', { timeout: 15000 });
  }, logger);

  await page.waitForTimeout(2000);
  logger.info(`Login successful — URL: ${page.url()}`);

  // ─────────────────────────────────────────────────────────────
  //  STEP 3 — NAVIGATE TO FILE INBOX QUEUE
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 3 — Navigate to File Inbox Queue (process=6)');

  await withRetry('Navigate to queue', async () => {
    await page.goto('http://172.168.50.94/queue/file-inbox?process=6',
      { waitUntil: 'networkidle', timeout: 20000 });
  }, logger);
  await page.waitForTimeout(2000);
  logger.info(`Queue page loaded — URL: ${page.url()}`);

  // ─────────────────────────────────────────────────────────────
  //  STEP 4 — SELECT GROUPING PROCESS
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 4 — Select Grouping Process from Dropdown');

  logger.info('Opening Select Process dropdown...');
  const processDropdown = page.locator('mat-select, select').first();
  await processDropdown.click();
  await page.waitForTimeout(800);

  const groupingOption = page.locator('mat-option, [role="option"]')
    .filter({ hasText: /Grouping|grouping/ }).first();

  if (await groupingOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await groupingOption.click();
    logger.info('Grouping process selected');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    logger.info(`URL after selection: ${page.url()}`);
  } else {
    logWarn('Grouping option NOT visible in dropdown — proceeding with current process');
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP 5 — COUNT FILES
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 5 — Count Files in Inbox');

  const SELECTOR = '[class*="inbox"], [class*="left-panel"], [class*="file-list"], tbody tr';

  await page.waitForSelector(SELECTOR, { timeout: 8000 })
    .catch(() => logWarn('File list selector not found — inbox may be empty'));

  fileCount = await page.locator(SELECTOR).count();
  logger.info(`Total files in inbox: ${fileCount}`);

  if (fileCount === 0) {
    logWarn('No files found — finishing test with empty run');
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP 6 — PROCESS EACH FILE
  // ─────────────────────────────────────────────────────────────
  logger.section(`STEP 6 — Process All ${fileCount} Files (Split → Confirm Split)`);

  for (let i = 0; i < fileCount; i++) {
    const fileLabel = `File ${i + 1} of ${fileCount}`;
    logger.info('─'.repeat(50));
    logger.info(`Processing ${fileLabel} ...`);

    const currentFile = page.locator(SELECTOR).nth(i);

    try {
      // ── Read and click file ──────────────────────────────────
      const fileText = await currentFile.textContent().catch(() => '(unreadable)');
      logger.info(`${fileLabel} — content: ${(fileText || '').trim().replace(/\s+/g, ' ')}`);

      await currentFile.click({ force: true });
      logger.info(`${fileLabel} — row clicked, waiting for iframe (10 s)`);
      await page.waitForTimeout(10000);

      // ── Screenshot of loaded file (unattended diagnostic) ────
      await page.screenshot({
        path: `screenshots/file-${i + 1}-loaded.png`,
        fullPage: false,
      }).catch(() => {});

      // ── Split button ─────────────────────────────────────────
      logger.info(`${fileLabel} — looking for Split button in iframe`);
      const splitBtn = page.frameLocator('iframe').locator('button:has-text("Split")').first();
      const splitOk  = await splitBtn.isVisible({ timeout: 8000 }).catch(() => false);

      if (!splitOk) {
        logWarn(`${fileLabel} — Split button NOT found — skipping file`);
        continue;
      }

      logger.info(`${fileLabel} — Split button found, clicking`);
      await splitBtn.click();
      logger.info(`${fileLabel} — waiting 2.5 s for Confirm Split dialog`);
      await page.waitForTimeout(2500);

      // ── Confirm Split button ─────────────────────────────────
      const allBtnCount = await page.locator('button').count();
      logger.info(`${fileLabel} — total buttons on page: ${allBtnCount}`);

      // Try primary selector
      const confirmBtn  = page.frameLocator('iframe').locator('button:has-text("Confirm Split")').first();
      let   confirmed   = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false);
      logger.info(`${fileLabel} — Confirm Split visible (primary): ${confirmed}`);

      // Fallback selector
      if (!confirmed) {
        logWarn(`${fileLabel} — trying fallback [role="button"] selector`);
        const altBtn = page.frameLocator('iframe')
          .locator('[role="button"]:has-text("Confirm Split")').first();
        confirmed = await altBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (confirmed) {
          logger.info(`${fileLabel} — Confirm Split found via fallback`);
          await altBtn.click();
        }
      } else {
        await confirmBtn.click();
      }

      if (!confirmed) {
        logWarn(`${fileLabel} — Confirm Split NOT found with any selector — skipping`);
        // Screenshot for investigation
        await page.screenshot({ path: `screenshots/file-${i + 1}-no-confirm.png` }).catch(() => {});
        continue;
      }

      logger.info(`${fileLabel} — Confirm Split clicked`);

      // ── Wait for split to complete ───────────────────────────
      logger.info(`${fileLabel} — Step 1: processing (3 s)`);
      await page.waitForTimeout(3000);
      logger.info(`${fileLabel} — Step 2: operation in progress (10 s)`);
      await page.waitForTimeout(10000);
      logger.info(`${fileLabel} — Step 3: dialog closing (4 s)`);
      await page.waitForTimeout(4000);
      logger.info(`${fileLabel} — Step 4: file list reload (3 s)`);
      await page.waitForTimeout(3000);
      logger.info(`${fileLabel} — split completed`);

      // ── Refresh and stabilise ────────────────────────────────
      logger.info(`${fileLabel} — reloading Grouping screen`);
      await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(4000);
      logger.info(`${fileLabel} — reload complete — URL: ${page.url()}`);
      await page.waitForTimeout(2000);
      logger.info(`${fileLabel} — ready for next file`);

    } catch (err) {
      const msg = `${fileLabel} — EXCEPTION: ${err.message}`;
      logger.error(msg);
      errors.push(msg);
      // Screenshot on every exception in unattended mode
      await page.screenshot({ path: `screenshots/file-${i + 1}-error.png` }).catch(() => {});
      // Continue to next file — do not abort the full run
      logger.info(`${fileLabel} — continuing to next file after error`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP 7 — SELECT CLASSIFICATION PROCESS AND ADD FIRST FILE TO QUERY
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 7 — Select Classification Process and Add First File to Query');

  logger.info('Opening Process dropdown to select classification process');
  const processDropdown2 = page.locator('mat-select, select').first();
  await processDropdown2.click();
  await page.waitForTimeout(800);

  const classificationOption = page.locator('mat-option, [role="option"]').filter({ hasText: /Classification|classification/ }).first();
  if (await classificationOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await classificationOption.click();
    logger.info('Classification process selected');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  } else {
    logWarn('Classification option not found in Process dropdown');
  }

  logger.info('Selecting first file in classification screen');
  const firstClassificationFile = page.locator(SELECTOR).first();
  if (await firstClassificationFile.isVisible({ timeout: 8000 }).catch(() => false)) {
    await firstClassificationFile.click({ force: true });
    await page.waitForTimeout(2000);
    logger.info('First file selected');
  } else {
    logWarn('First file row not visible on classification screen');
  }

  logger.info('Opening Add to query dropdown');
  let addToQueryDropdown = page.locator('label:has-text("Add to query"), label:has-text("Add to Query")')
    .locator('..')
    .locator('mat-select, select')
    .first();

  if (!(await addToQueryDropdown.count())) {
    addToQueryDropdown = page.locator('mat-select, select').filter({ hasText: /Add to query|Add to Query|Query/i }).first();
  }

  if (await addToQueryDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addToQueryDropdown.click();
    await page.waitForTimeout(800);
    const addToQueryOption = page.locator('mat-option, [role="option"]').first();
    if (await addToQueryOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addToQueryOption.click();
      logger.info('Selected first Add to query option');
    } else {
      logWarn('No option visible in Add to query dropdown');
    }
  } else {
    logWarn('Add to query dropdown not found');
  }

  const addToQueryButton = page.locator('button:has-text("Add to query"), button:has-text("Add to Query")').first();
  if (await addToQueryButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addToQueryButton.click();
    logger.info('Add to query button clicked');
    await page.waitForTimeout(2000);
  } else {
    logWarn('Add to query button not found');
  }

  const saveButton = page.locator('button:has-text("Save")').first();
  if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await saveButton.click();
    logger.info('Save button clicked');
    await page.waitForTimeout(3000);
  } else {
    logWarn('Save button not found');
  }

  // ─────────────────────────────────────────────────────────────
  //  STEP 8 — POST-LOOP VALIDATION
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 8 — Post-Loop Validation');

  await page.waitForTimeout(2000);
  const pageTitle = await page.title();
  logger.info(`Page title: "${pageTitle}"`);
  expect(pageTitle).toBeTruthy();

  const finalUrl = page.url();
  logger.info(`Final URL: ${finalUrl}`);

  if (finalUrl.includes('process=7')) {
    logger.info('URL VALIDATION PASSED — process=7 present');
  } else {
    logWarn(`URL VALIDATION — "process=7" not found in: ${finalUrl}`);
  }
  expect(finalUrl).toContain('process=7');

  // ─────────────────────────────────────────────────────────────
  //  STEP 8 — FINAL SCREENSHOT
  // ─────────────────────────────────────────────────────────────
  logger.section('STEP 8 — Final Screenshot');
  await page.screenshot({ path: 'screenshots/tabak-completed.png', fullPage: true });
  logger.info('Final screenshot saved: screenshots/tabak-completed.png');

  // ─────────────────────────────────────────────────────────────
  //  STEP 9 — SUMMARY
  // ─────────────────────────────────────────────────────────────
  logger.info('Test execution complete');
  logger.summary(fileCount, errors);
});
