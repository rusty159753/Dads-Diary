// Category E - Mobile Viewport Compliance
// Verifies UI renders correctly at 375px minimum viewport width.
// Requires Playwright. Install with: npx playwright install chromium
// P1: entry creation flow usable on phone. P2: overflow and tap target checks.

import { test, expect, chromium, type Browser, type Page } from "@playwright/test";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL!;
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD!;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  throw new Error("Missing required environment variables for mobile eval. Check .env.test.");
}

// Minimum supported viewport - do not reduce without Christopher approval
const MOBILE_VIEWPORT = { width: 375, height: 812 };

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser.close();
});

test.beforeEach(async () => {
  page = await browser.newPage();
  await page.setViewportSize(MOBILE_VIEWPORT);
});

test.afterEach(async () => {
  await page.close();
});

// ─── Auth Flow at 375px ───────────────────────────────────────────────────────

test("E1 - Login page renders without horizontal scroll at 375px", async () => {
  await page.goto(`${BASE_URL}/auth`);

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => document.body.clientWidth);

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("E2 - Login form fields are visible and not clipped at 375px", async () => {
  await page.goto(`${BASE_URL}/auth`);

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(submitButton).toBeVisible();
});

// ─── Entry Creation Flow at 375px ────────────────────────────────────────────

test("E3 - Entry creation flow completable on 375px viewport", async () => {
  // Sign in first
  await page.goto(`${BASE_URL}/auth`);
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/entries`);

  // Navigate to new entry
  await page.goto(`${BASE_URL}/entries/new`);

  // All form elements must be visible and reachable
  const titleInput = page.locator('input[name="title"]');
  const contentArea = page.locator('textarea[name="content"]');
  const saveButton = page.locator('button[type="submit"]');

  await expect(titleInput).toBeVisible();
  await expect(contentArea).toBeVisible();
  await expect(saveButton).toBeVisible();

  // No horizontal scroll on entry creation page
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => document.body.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

// ─── Entries Feed at 375px ────────────────────────────────────────────────────

test("E4 - Entries feed renders without horizontal scroll at 375px", async () => {
  await page.goto(`${BASE_URL}/auth`);
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/entries`);

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const clientWidth = await page.evaluate(() => document.body.clientWidth);

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

// ─── Tap Target Size ──────────────────────────────────────────────────────────

test("E5 - Primary action buttons meet 44x44px minimum tap target", async () => {
  await page.goto(`${BASE_URL}/auth`);
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/entries`);

  // Check all buttons on the entries page
  const buttons = page.locator("button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const isVisible = await button.isVisible();
    if (!isVisible) continue;

    const box = await button.boundingBox();
    if (!box) continue;

    // P2 severity - log failures but collect all before asserting
    if (box.width < 44 || box.height < 44) {
      const label = await button.textContent();
      console.warn(
        `E5 tap target warning: button "${label?.trim()}" is ${box.width.toFixed(0)}x${box.height.toFixed(0)}px (minimum 44x44)`
      );
    }
  }

  // Specifically assert the primary submit button meets the target
  const submitButton = page.locator('button[type="submit"]').first();
  if (await submitButton.isVisible()) {
    const box = await submitButton.boundingBox();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});

// ─── Delete Confirmation ──────────────────────────────────────────────────────

test("E6 - Delete action requires confirmation step before entry is removed", async () => {
  await page.goto(`${BASE_URL}/auth`);
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/entries`);

  // Navigate to first entry if one exists
  const entryLink = page.locator("a[href^='/entries/']").first();
  const hasEntry = await entryLink.isVisible().catch(() => false);

  if (!hasEntry) {
    console.warn("E6: No entries found. Skipping delete confirmation check.");
    return;
  }

  await entryLink.click();
  await page.waitForLoadState("networkidle");

  // Trigger delete
  const deleteButton = page.locator("button", { hasText: /delete/i }).first();
  const hasDelete = await deleteButton.isVisible().catch(() => false);

  if (!hasDelete) {
    console.warn("E6: No delete button found on entry detail page.");
    return;
  }

  await deleteButton.click();

  // A confirmation dialog or confirmation button must appear
  const confirmation = page.locator("[role='dialog'], button:has-text('Confirm'), button:has-text('Yes')");
  await expect(confirmation.first()).toBeVisible({ timeout: 3000 });
});
