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
  const firestoreRequests = [];
  await context.route("https://firestore.googleapis.com/**", async (route) => {
    firestoreRequests.push({ url: route.request().url(), method: route.request().method() });
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  const failedRequests = [];
  const scriptResponses = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(request.url() + " :: " + request.failure()?.errorText));
  page.on("response", (response) => {
    if (/assets\/js\/(?:main|nav)\.js/.test(response.url())) {
      scriptResponses.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto(base + "/features/", { waitUntil: "networkidle" });

  const header = page.locator(".site-header");
  assert.equal(await header.evaluate((el) => el.classList.contains("is-solid")), false,
    "header should start transparent");
  const topPadding = await header.evaluate((el) => getComputedStyle(el).paddingTop);
  assert.equal(topPadding, "16px", "header should keep its expanded top-of-page spacing");

  await page.evaluate(() => {
    window.__testScrollEvents = 0;
    window.addEventListener("scroll", () => { window.__testScrollEvents += 1; }, { passive: true });
  });
  await page.locator("#services").evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY > 8);
  await page.waitForTimeout(150);
  const navDiagnostics = await page.evaluate(() => ({
    scrollY: window.scrollY,
    rootScrollTop: document.scrollingElement?.scrollTop,
    scrollEvents: window.__testScrollEvents,
    solid: document.querySelector(".site-header")?.classList.contains("is-solid"),
    mainScript: performance.getEntriesByType("resource").map((x) => x.name).filter((x) => x.includes("main.js")),
    navScript: performance.getEntriesByType("resource").map((x) => x.name).filter((x) => x.includes("nav.js"))
  }));
  assert.equal(navDiagnostics.solid, true,
    "header should become solid after scrolling. Diagnostics: " + JSON.stringify({
      ...navDiagnostics, pageErrors: errors, consoleErrors, failedRequests, scriptResponses
    }));
  await page.waitForFunction(() => Math.abs(parseFloat(getComputedStyle(document.querySelector(".site-header")).paddingTop) - 10) < 0.1);
  const solidState = await header.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    padding: getComputedStyle(el).paddingTop
  }));
  assert.ok(solidState.background.includes("255, 255, 255"), "header should turn white after scrolling");
  assert.ok(Math.abs(parseFloat(solidState.padding) - 10) < 0.1, "header should compact after scrolling");
  await page.waitForTimeout(350); // allow the logo fill transition to finish before reading the final colours
  const logoColors = await header.evaluate((el) => ({
    mark: getComputedStyle(el.querySelector(".logo .lg-a")).fill,
    wordmark: getComputedStyle(el.querySelector(".logo .lg-b")).fill
  }));
  assert.equal(logoColors.mark, "rgb(22, 153, 107)", "Faxton mark should return to its green brand colour after scrolling");
  assert.equal(logoColors.wordmark, "rgb(18, 74, 56)", "the second logo colour should return to dark green after scrolling");

  await page.goto(base + "/", { waitUntil: "networkidle" });
  // Homepage header CTA should scroll to the waitlist and leave the form clear of the fixed header.
  await page.locator('.site-header a[data-spa-waitlist]').click();
  await page.waitForFunction(() => location.hash === "#waitlist");
  await page.waitForFunction(() => {
    const section = document.querySelector("#waitlist");
    const top = section?.getBoundingClientRect().top ?? -999;
    return top >= 0 && top < 160;
  });
  await page.waitForFunction(() => document.activeElement?.id === "wl-role");
  assert.equal(await page.locator("#wl-role").evaluate((el) => el === document.activeElement), true,
    "homepage signup CTA should focus the account-role selector");
  await page.locator("#download").scrollIntoViewIfNeeded();
  await page.locator('.dlx-card[data-g="windows"] .dlx-head').click();
  await page.waitForSelector('.dlx-sheet a.dlx-opt[href]');
  const windowsLinks = await page.$$eval(
    '.dlx-sheet a.dlx-opt[href]',
    (anchors) => anchors.map((anchor) => anchor.getAttribute("href"))
  );
  assert.equal(windowsLinks.length, 2, "Windows picker should show both published installers");
  assert.ok(windowsLinks.every((url) => url.startsWith(`https://github.com/${repo}/releases/download/v1.2.0/`)),
    "Windows links should point to the published release");

  // The visible Download now action opens the detected device picker.
  await page.locator("[data-dl-now]").click();
  await page.waitForSelector(".dlx-sheet");
  assert.equal(await page.$eval(".dlx-card.open", (el) => el.dataset.g), "windows",
    "Download now should open the detected Windows picker");
  await page.locator(".dlx-sheet .dlx-x").click();

  // Website signup must hand off to the real app instead of attempting an anonymous Firestore write.
  await page.locator("#wl-role").selectOption("owner");
  assert.equal(await page.locator("[data-wl-app-link]").getAttribute("href"),
    "https://faxton-rentals.web.app/app/#/signup?role=landlord",
    "home-owner signup should open the app with its internal landlord role");
  await page.locator("#wl-role").selectOption("agency");
  assert.equal(await page.locator("[data-wl-app-link]").getAttribute("href"),
    "https://faxton-rentals.web.app/app/#/signup?role=agency",
    "business signup should preserve the agency role");
  await page.locator("#wl-role").selectOption("agent");
  assert.equal(await page.locator("[data-wl-app-link]").getAttribute("href"),
    "https://faxton-rentals.web.app/app/#/signup?role=agent",
    "agent signup should preserve the agent role");
  await page.locator("#wl-role").selectOption("renter");
  assert.equal(await page.locator("[data-wl-app-link]").getAttribute("href"),
    "https://faxton-rentals.web.app/app/#/signup?role=renter",
    "renter signup should open the app signup route");

  // The footer action on a page without a download section should navigate home and open the picker.
  await page.goto(base + "/contact/", { waitUntil: "networkidle" });
  // The fixed header CTA on inner pages should return to the homepage waitlist.
  await page.locator('.site-header a[data-spa-waitlist]').click();
  await page.waitForURL((url) => url.pathname === "/" && url.hash === "#waitlist");
  await page.waitForSelector("#wl-role");
  // Features-to-home SPA navigation must retain the homepage's dedicated waitlist layout.
  await page.goto(base + "/features/", { waitUntil: "networkidle" });
  await page.locator('.site-header a[data-spa-waitlist]').click();
  await page.waitForURL((url) => url.pathname === "/" && url.hash === "#waitlist");
  const waitlistLayout = await page.locator("#waitlist").evaluate((section) => ({
    page: document.body.dataset.page,
    stylesheet: [...document.styleSheets].some((sheet) => sheet.href?.includes("waitlist-renter.css")),
    headerDisplay: getComputedStyle(section.querySelector(".wl__head")).display,
    formDisplay: getComputedStyle(section.querySelector(".wl__form")).display,
    fields: [...section.querySelectorAll(".wl__form > .field")].map((field) => {
      const rect = field.getBoundingClientRect();
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
    }),
    submit: (() => {
      const button = section.querySelector("[data-wl-app-link");
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return { top: Math.round(rect.top), gridColumnStart: style.gridColumnStart, gridColumnEnd: style.gridColumnEnd };
    })()
  }));
  assert.equal(waitlistLayout.page, "home", "Features waitlist CTA should load the homepage");
  assert.equal(waitlistLayout.stylesheet, true, "homepage waitlist stylesheet should be available after SPA navigation");
  assert.equal(waitlistLayout.headerDisplay, "grid", "homepage waitlist heading should retain its original grid layout");
  assert.equal(waitlistLayout.formDisplay, "grid", "homepage waitlist form should retain its grid layout");
  assert.equal(waitlistLayout.fields.length, 1, "the signup handoff should only ask for the account role");
  assert.equal(waitlistLayout.submit.gridColumnStart, "auto", "the app signup link should sit beside the role selector");
  assert.equal(waitlistLayout.submit.gridColumnEnd, "auto", "the app signup link should not span a separate form row");
  assert.equal(waitlistLayout.submit.top, waitlistLayout.fields[0].top, "the app signup link should align with the role selector");
  await page.goto(base + "/contact/", { waitUntil: "networkidle" });
  await page.locator("a[data-get-app]").click();
  await page.waitForURL((url) => url.pathname === "/" && url.hash === "#download");
  await page.waitForSelector(".dlx-sheet");
  assert.equal(await page.$eval(".dlx-card.open", (el) => el.dataset.g), "windows",
    "footer Get the app action should open the detected device picker");
  assert.deepEqual(firestoreRequests, [], "marketing signup must not attempt blocked anonymous Firestore writes");
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
    '.dlx-sheet a.dlx-opt[href]',
    (anchors) => anchors.map((anchor) => anchor.getAttribute("href"))
  );
  assert.equal(fallbackLinks.length, 2, "manifest fallback should keep Windows downloads available");
  await fallbackContext.close();

  // Mobile layout regressions: the privacy text must keep a readable side gutter,
  // and the Features page must not introduce horizontal page overflow.
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(base + "/privacy/", { waitUntil: "networkidle" });
  const privacyLayout = await mobilePage.locator(".fr-privacy").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, right: window.innerWidth - rect.right, width: rect.width,
      stylesheet: [...document.styleSheets].map((s) => s.href || "").find((href) => href.includes("pages.css")) };
  });
  assert.ok(privacyLayout.left >= 12 && privacyLayout.right >= 12,
    "Privacy Policy should keep visible side margins on mobile: " + JSON.stringify(privacyLayout));
  assert.ok(privacyLayout.stylesheet?.includes("2026-11-25.2"),
    "Privacy Policy should load the refreshed stylesheet instead of a cached older version");
  await mobilePage.goto(base + "/", { waitUntil: "networkidle" });
  await mobilePage.locator(".menu-btn").click();
  await mobilePage.locator('#mobile-menu a[data-spa-waitlist]').click();
  await mobilePage.waitForFunction(() => location.hash === "#waitlist");
  await mobilePage.waitForSelector("#wl-role");
  assert.equal(await mobilePage.locator("#wl-role").isVisible(), true,
    "mobile menu signup action should reveal the app handoff");
  await mobilePage.goto(base + "/features/", { waitUntil: "networkidle" });
  const featureLayout = await mobilePage.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    heading: document.querySelector(".frf-hero h1")?.getBoundingClientRect().width
  }));
  assert.ok(featureLayout.document <= featureLayout.viewport + 1,
    "Features page should not overflow horizontally on mobile: " + JSON.stringify(featureLayout));
  await mobilePage.locator('.menu-btn').click();
  await mobilePage.locator('#mobile-menu a[data-spa-waitlist]').click();
  await mobilePage.waitForURL((url) => url.pathname === "/" && url.hash === "#waitlist");
  const mobileWaitlist = await mobilePage.locator("#waitlist").evaluate((section) => ({
    stylesheet: [...document.styleSheets].some((sheet) => sheet.href?.includes("waitlist-renter.css")),
    formDisplay: getComputedStyle(section.querySelector(".wl__form")).display,
    fieldTops: [...section.querySelectorAll(".wl__form > .field")].map((field) => Math.round(field.getBoundingClientRect().top)),
    submitTop: Math.round(section.querySelector("[data-wl-app-link]").getBoundingClientRect().top)
  }));
  assert.equal(mobileWaitlist.stylesheet, true, "mobile Features CTA should load the homepage waitlist stylesheet");
  assert.equal(mobileWaitlist.formDisplay, "grid", "mobile waitlist should retain its grid layout");
  assert.equal(mobileWaitlist.fieldTops.length, 1, "mobile signup handoff should only show the role selector");
  assert.ok(mobileWaitlist.submitTop > mobileWaitlist.fieldTops[0],
    "mobile app signup link should follow the role selector");
  await mobileContext.close();
  process.stdout.write("PASS: navbar scroll state, device picker, footer entry point, release fallback, and mobile layouts\\n");
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
