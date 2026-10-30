// Focused browser regression checks for the two public-site issues: sticky header state and downloads.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon"
};
const server = createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }
  let file = resolve(root, "." + pathname);
  if (!file.startsWith(root)) { res.writeHead(403).end("Forbidden"); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    const notFound = join(root, "404.html");
    res.writeHead(404, { "Content-Type": types[".html"], "Cache-Control": "no-store" });
    res.end(readFileSync(notFound));
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(readFileSync(file));
});
await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});
const base = `http://127.0.0.1:${server.address().port}`;

const repo = "musazaneerah4-crypto/Faxton-Rentals-Downloads";
const files = [
  "Faxton-Rentals-Android.apk", "Faxton-Rentals-Android-x64.apk", "Faxton-Rentals-Android.aab",
  "Faxton-Rentals-iPhone-unsigned.ipa", "Faxton-Rentals-Windows-x64.exe",
  "Faxton-Rentals-Windows-arm64.exe", "Faxton-Rentals-Mac-arm64.dmg",
  "Faxton-Rentals-Mac-x64.dmg", "Faxton-Rentals-Linux-x86_64.AppImage",
  "Faxton-Rentals-Linux-arm64.AppImage", "Faxton-Rentals-Linux-x64.deb",
  "Faxton-Rentals-Linux-arm64.deb"
];
const release = {
  tag_name: "v1.2.0",
  name: "Faxton Rentals 1.2.0",
  html_url: `https://github.com/${repo}/releases/tag/v1.2.0`,
  body: "Current published packages",
  assets: files.map((name, i) => ({
    name,
    size: (i + 1) * 1024 * 1024,
    browser_download_url: `https://github.com/${repo}/releases/download/v1.2.0/${name}`
  }))
};
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const browser = await chromium.launch({ headless: true });

try {
  // Header + normal download behaviour with a working release API.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: ua });
  await context.route(`https://api.github.com/repos/${repo}/releases/latest`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(release)
    })
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/features/", { waitUntil: "networkidle" });

  const header = page.locator(".site-header");
  assert.equal(await header.evaluate((el) => el.classList.contains("is-solid")), false,
    "header should start transparent");
  const topPadding = await header.evaluate((el) => getComputedStyle(el).paddingTop);
  assert.equal(topPadding, "16px", "header should keep its expanded top-of-page spacing");

  await page.locator("#services").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY > 8);
  await page.waitForFunction(() => document.querySelector(".site-header")?.classList.contains("is-solid"));
  const solidState = await header.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    padding: getComputedStyle(el).paddingTop
  }));
  assert.ok(solidState.background.includes("255, 255, 255"), "header should turn white after scrolling");
  assert.equal(solidState.padding, "10px", "header should compact after scrolling");

  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("#download").scrollIntoViewIfNeeded();
  await page.locator('.dlx-card[data-g="windows"] .dlx-head').click();
  await page.waitForSelector('.dlx-sheet a.dlx-opt[href]');
  const windowsLinks = await page.$$eval(
    '.dlx-card[data-g="windows"] .dlx-sheet a.dlx-opt[href]',
    (anchors) => anchors.map((anchor) => anchor.getAttribute("href"))
  );
  assert.equal(windowsLinks.length, 2, "Windows picker should show both published installers");
  assert.ok(windowsLinks.every((url) => url.startsWith(`https://github.com/${repo}/releases/download/v1.2.0/`)),
    "Windows links should point to the published release");

  // The footer action on a page without a download section should navigate home and open the picker.
  await page.goto(base + "/contact/", { waitUntil: "networkidle" });
  await page.locator("a[data-get-app]").click();
  await page.waitForURL((url) => url.pathname === "/" && url.hash === "#download");
  await page.waitForSelector(".dlx-card.open .dlx-sheet");
  assert.equal(await page.$eval(".dlx-card.open", (el) => el.dataset.g), "windows",
    "footer Get the app action should open the detected device picker");
  assert.deepEqual(errors, [], "normal download flow should not produce browser JavaScript errors");
  await context.close();

  // A GitHub API rate-limit response must use the same-site copy of the current release manifest.
  const fallbackContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: ua });
  await fallbackContext.route(`https://api.github.com/repos/${repo}/releases/latest`, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ message: "API rate limit exceeded" })
    })
  );
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(base + "/", { waitUntil: "networkidle" });
  await fallbackPage.locator("#download").scrollIntoViewIfNeeded();
  await fallbackPage.locator('.dlx-card[data-g="windows"] .dlx-head').click();
  await fallbackPage.waitForSelector('.dlx-sheet a.dlx-opt[href]');
  const fallbackLinks = await fallbackPage.$$eval(
    '.dlx-card[data-g="windows"] .dlx-sheet a.dlx-opt[href]',
    (anchors) => anchors.map((anchor) => anchor.getAttribute("href"))
  );
  assert.equal(fallbackLinks.length, 2, "manifest fallback should keep Windows downloads available");
  await fallbackContext.close();
  process.stdout.write("PASS: navbar scroll state, device picker, footer entry point, and release fallback\n");
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
