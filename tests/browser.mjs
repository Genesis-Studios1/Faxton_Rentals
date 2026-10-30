// Browser checks for the Faxton Rentals website (Playwright + Chromium). Not needed to run the site.
//
//   npm i -D playwright            (once; or point NODE_PATH-style tooling at an existing install)
//   CHROMIUM_PATH=/path/to/chrome node tests/browser.mjs        (CHROMIUM_PATH is optional)
//
// It starts its own static server (with a 404 page like GitHub Pages), mocks Firestore and the GitHub API,
// and checks every page at 390, 820 and 1440 px wide: console errors, CSP violations, horizontal overflow,
// broken images and links, tap targets, text contrast, the mobile menu, the forms (valid, invalid, already
// exists, error), the download picker for every operating system, and page weight. Screenshots go to tests/out/.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "tests", "out");
mkdirSync(OUT, { recursive: true });
const { chromium } = await import("playwright");

// ---------- tiny static server ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain", ".xml": "application/xml" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404, { "Content-Type": TYPES[".html"] }).end(readFileSync(join(root, "404.html"))); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- results ----------
let pass = 0, fail = 0;
const failures = [];
const ok = (cond, name, detail = "") => { if (cond) pass++; else { fail++; failures.push(`${name}${detail ? "  -> " + detail : ""}`); } console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && detail ? "  -> " + detail : ""}`); };

// ---------- mocks ----------
const NAMES = ["Faxton-Rentals-Android.apk", "Faxton-Rentals-Android-x64.apk", "Faxton-Rentals-Android.aab", "Faxton-Rentals-iPhone-unsigned.ipa", "Faxton-Rentals-Windows-x64.exe", "Faxton-Rentals-Windows-arm64.exe", "Faxton-Rentals-Mac-arm64.dmg", "Faxton-Rentals-Mac-x64.dmg", "Faxton-Rentals-Linux-x64.AppImage", "Faxton-Rentals-Linux-arm64.AppImage", "Faxton-Rentals-Linux-x64.deb", "Faxton-Rentals-Linux-arm64.deb"];
const REPO = "musazaneerah4-crypto/Faxton-Rentals-Downloads";
const releaseJson = (names = NAMES) => ({ tag_name: "v1.2.3", html_url: `https://github.com/${REPO}/releases/tag/v1.2.3`, body: "Notes", assets: names.map((n, i) => ({ name: n, size: (i + 3) * 4_200_000, browser_download_url: `https://github.com/${REPO}/releases/download/v1.2.3/${n}` })) });
const FIRESTORE = /^https:\/\/firestore\.googleapis\.com\//;
const GITHUB = /^https:\/\/api\.github\.com\//;

async function newPage(browser, { width = 1440, height = 900, ua, reduced = false, config, github = "ok", firestore = "ok", mobile = width < 700 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, colorScheme: "light", reducedMotion: reduced ? "reduce" : "no-preference", ...(ua ? { userAgent: ua } : {}) });
  const page = await ctx.newPage();
  const state = { errors: [], requests: [], fsCalls: [], ghCalls: 0, weight: 0, github, firestore };
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") state.errors.push(`${m.type()}: ${m.text().slice(0, 220)}`); });
  page.on("pageerror", (e) => state.errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => { if (!FIRESTORE.test(r.url()) && !GITHUB.test(r.url())) state.errors.push("requestfailed: " + r.url()); });
  page.on("response", async (r) => { try { const len = +r.headers()["content-length"] || 0; state.weight += len; } catch { /* ignore */ } });
  await ctx.route(FIRESTORE, async (route) => {
    const req = route.request();
    state.fsCalls.push({ url: req.url(), method: req.method(), body: req.postData() });
    const mode = state.firestore;
    if (mode === "abort") return route.abort("failed");
    const map = { ok: [200, {}], exists: [409, { error: { code: 409, status: "ALREADY_EXISTS" } }], denied: [403, { error: { code: 403, status: "PERMISSION_DENIED" } }], error: [500, { error: { code: 500 } }] };
    const [status, body] = map[mode] || map.ok;
    return route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  });
  await ctx.route(GITHUB, async (route) => {
    state.ghCalls++;
    const g = state.github;
    if (g === "abort") return route.abort("failed");
    if (g === "404") return route.fulfill({ status: 404, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
    const names = g === "partial" ? ["Faxton-Rentals-Android.apk", "Faxton-Rentals-Windows-x64.exe"] : NAMES;
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(releaseJson(names)) });
  });
  if (config) await ctx.route("**/assets/site-config.js", (route) => route.fulfill({ contentType: "text/javascript", body: `window.FAXTON_SITE = ${JSON.stringify(config)};` }));
  return { ctx, page, state };
}
const goto = async (page, path) => { await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(250); };
const scrollAll = async (page) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 450) { await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y); await page.waitForTimeout(90); }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(600);
};
const sha32 = (e) => createHash("sha256").update(e.toLowerCase().trim()).digest("hex").slice(0, 32);

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {}) });

const ALL_PAGES = [["home", "/"], ["features", "/features/"], ["contact", "/contact/"], ["about", "/about/"], ["billing", "/billing/"], ["404", "/404.html"]];
// Optional filters for quick runs:  PAGES=about,billing WIDTHS=1440 QUICK=1 node tests/browser.mjs
const PAGES = process.env.PAGES ? ALL_PAGES.filter(([n]) => process.env.PAGES.split(",").includes(n)) : ALL_PAGES;
const WIDTHS = process.env.WIDTHS ? process.env.WIDTHS.split(",").map(Number) : [390, 820, 1440];
const EXTRA_WIDTHS = process.env.QUICK ? [] : [360, 1280, 1920];
const QUICK = !!process.env.QUICK;

// ====================================================================== 1. every page, every width
for (const w of WIDTHS) {
  for (const [name, path] of PAGES) {
    const tag = `${name}@${w}`;
    const { ctx, page, state } = await newPage(browser, { width: w, height: w < 700 ? 844 : 900 });
    await goto(page, path);
    const initialWeight = state.weight;
    await scrollAll(page);
    await page.screenshot({ path: join(OUT, `${name}_${w}.png`), fullPage: true });

    ok(state.errors.length === 0, `${tag}: no console errors, CSP violations or failed requests`, state.errors.join(" | "));

    const m = await page.evaluate(() => {
      const de = document.documentElement, vw = de.clientWidth;
      const over = [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !el.closest(".jump__bar, .hp, .sr-only, .skip-link, .site-foot, .phone, .m-menu, .fx-toast, .hero__bg, .cta-band__bg"); }).slice(0, 5).map((el) => el.tagName + "." + el.className + " " + Math.round(el.getBoundingClientRect().right));
      const imgs = [...document.images].filter((i) => i.offsetParent !== null || i.closest("picture"));
      const broken = imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute("src"));
      const noDims = imgs.filter((i) => !i.getAttribute("width") || !i.getAttribute("height")).map((i) => i.getAttribute("src"));
      const noAlt = imgs.filter((i) => !i.hasAttribute("alt")).map((i) => i.getAttribute("src"));
      const h1 = document.querySelectorAll("h1").length;
      const hs = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => +h.tagName[1]);
      let skips = 0; for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skips++;
      const reveal = [...document.querySelectorAll(".reveal")].filter((e) => !e.classList.contains("in") && getComputedStyle(e).opacity === "0").length;
      return { sw: de.scrollWidth, vw, over, broken, noDims, noAlt, h1, skips, reveal, lang: de.lang, title: document.title, desc: document.querySelector('meta[name="description"]')?.content || "", canonical: document.querySelector('link[rel=canonical]')?.getAttribute("href"), og: ["og:title", "og:description", "og:image"].every((p) => document.querySelector(`meta[property="${p}"]`)?.content), tw: document.querySelector('meta[name="twitter:card"]')?.content, csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), manifest: !!document.querySelector('link[rel=manifest]'), icon: !!document.querySelector('link[rel=apple-touch-icon]'), main: !!document.querySelector("main#main"), skip: !!document.querySelector('a.skip-link[href="#main"]') };
    });
    ok(m.sw <= m.vw, `${tag}: no horizontal scroll`, `scrollWidth ${m.sw} > ${m.vw}; ${m.over.join("; ")}`);
    ok(m.over.length === 0, `${tag}: nothing pokes out of the viewport`, m.over.join("; "));
    ok(m.broken.length === 0, `${tag}: all images loaded`, m.broken.join(", "));
    ok(m.noDims.length === 0 && m.noAlt.length === 0, `${tag}: images have width, height and alt`, [...m.noDims, ...m.noAlt].join(", "));
    ok(m.h1 === 1, `${tag}: exactly one h1`, String(m.h1));
    ok(m.skips === 0, `${tag}: heading levels do not skip`, String(m.skips));
    ok(m.reveal === 0, `${tag}: nothing left hidden by reveal animations`, String(m.reveal));
    if (w === 1440) {
      ok(m.lang === "en" && m.title.length > 8 && m.title.length < 70 && m.desc.length > 60 && m.desc.length <= 175, `${tag}: title and description`, `${m.title} / ${m.desc.length}`);
      ok(!!m.canonical && m.og && m.tw === "summary_large_image" && m.csp && m.manifest && m.icon && m.main && m.skip, `${tag}: canonical, Open Graph, Twitter card, CSP, manifest, icons, main landmark, skip link`);
    }

    // tap targets on phones
    if (w === 390) {
      const small = await page.evaluate(() => {
        const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]';
        return [...document.querySelectorAll(sel)].filter((el) => {
          if (el.closest(".hp, .sr-only, [hidden], .m-menu[hidden]") || el.matches(".skip-link")) return false;
          const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") return false;
          const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || r.bottom < 0) return false;
          const inline = el.tagName === "A" && cs.display === "inline" && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 3;
          if (inline) return false; // links inside a sentence are exempt (WCAG 2.5.8)
          return r.width < 43.5 || r.height < 43.5;
        }).slice(0, 8).map((el) => `${el.tagName}.${(el.className || "").toString().split(" ")[0]} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
      });
      ok(small.length === 0, `${tag}: tap targets are at least 44x44`, small.join(" | "));
    }

    // text contrast on solid backgrounds (text over photos is checked separately below)
    if (w !== 820) {
      const bad = await page.evaluate(() => {
        const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
        const bgOf = (el) => { let layers = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== "none") return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; } } let base = { r: 251, g: 253, b: 251, a: 1 }; for (const l of layers.reverse()) base = blend(l, base); return base; };
        const out = [];
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest(".hero, .cta-band, .m-menu[hidden], .sr-only, .hp, .phone, svg, [aria-hidden='true']") || el.closest(".site-header:not(.is-solid)")) continue;
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue;
          const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const bg = bgOf(el); if (!bg) continue;
          const fg = parse(cs.color); if (!fg) continue;
          const c = fg.a < 1 ? blend(fg, bg) : fg;
          const L1 = lum(c), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
          const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
          if (ratio < need) out.push(`${el.tagName}.${(el.className || "").toString().split(" ")[0]} "${el.textContent.trim().slice(0, 28)}" ${ratio.toFixed(2)}<${need}`);
        }
        return [...new Set(out)].slice(0, 8);
      });
      ok(bad.length === 0, `${tag}: text contrast >= 4.5:1 (3:1 for large text) on solid backgrounds`, bad.join(" | "));
    }

    // text over the hero photo: measure the brightest 3% of pixels behind each text block
    if (w !== 820 && ["home", "features", "contact", "about", "billing"].includes(name)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(500);
      const boxes = await page.evaluate(() => [...document.querySelectorAll(".hero h1, .hero .hero__lead, .hero .eyebrow, .hero .pills, .hero .hand")].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, c: getComputedStyle(e).color, n: e.className || e.tagName, fs: parseFloat(getComputedStyle(e).fontSize) }; }).filter((b) => b.w > 10 && b.h > 10 && b.y >= 0));
      // hide the text itself (CSSOM only: the page's CSP forbids injected <style> tags) so the photo behind it can be measured
      await page.evaluate(() => {
        document.querySelectorAll(".hero h1, .hero .hero__lead, .hero .eyebrow, .hero .hand, .hero .pills li").forEach((e) => e.style.setProperty("visibility", "hidden", "important"));
        document.querySelector(".site-header").style.setProperty("visibility", "hidden", "important");
      });
      await page.waitForTimeout(150);
      let worst = 99, worstName = "", worstNeed = 4.5;
      for (const b of boxes) {
        if (/pills/.test(String(b.n))) continue;
        const png = await page.screenshot({ clip: { x: Math.max(0, b.x), y: b.y, width: Math.min(b.w, w - Math.max(0, b.x)), height: Math.min(b.h, 400) } });
        const p95 = await page.evaluate(async (b64) => {
          const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
          const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data; const ls = [];
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          for (let i = 0; i < d.length; i += 4) ls.push(0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]));
          ls.sort((a, b) => a - b); return ls[Math.floor(ls.length * 0.97)];
        }, png.toString("base64"));
        const white = 1.05 / (p95 + 0.05);
        const lime = /lime|accent/.test(String(b.n)); // lime text is lighter than white; judged by its own colour below
        const txt = b.c.match(/\d+/g).map(Number); const tl = (() => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(txt[0]) + 0.7152 * f(txt[1]) + 0.0722 * f(txt[2]); })();
        const ratio = (Math.max(tl, p95) + 0.05) / (Math.min(tl, p95) + 0.05);
        void white; void lime;
        const need = b.fs >= 24 ? 3 : 4.5;
        if (ratio / need < worst / worstNeed) { worst = ratio; worstNeed = need; worstName = String(b.n).split(" ")[0]; }
      }
      ok(worst >= worstNeed, `${tag}: hero text keeps its contrast (4.5:1, or 3:1 for large text) against the brightest part of the photo behind it`, `${worst.toFixed(2)} on ${worstName} (needs ${worstNeed})`);
    }
    await ctx.close();
  }
}

// ====================================================================== 1b. the other common widths (lighter checks)
for (const w of EXTRA_WIDTHS) {
  for (const [name, path] of PAGES) {
    const tag = `${name}@${w}`;
    const { ctx, page, state } = await newPage(browser, { width: w, height: w < 700 ? 800 : w > 1600 ? 1080 : 800 });
    await goto(page, path); await scrollAll(page);
    await page.screenshot({ path: join(OUT, `${name}_${w}.png`), fullPage: true });
    const m = await page.evaluate((w) => {
      const de = document.documentElement, vw = de.clientWidth;
      const over = [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !el.closest(".jump__bar, .hp, .sr-only, .skip-link, .site-foot, .m-menu, .fx-toast, .hero__bg, .cta-band__bg"); }).slice(0, 4).map((el) => el.tagName + "." + el.className);
      const broken = [...document.images].filter((i) => (i.offsetParent !== null || i.closest("picture")) && !(i.complete && i.naturalWidth > 0)).map((i) => i.getAttribute("src"));
      const small = w <= 400 ? [...document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary")].filter((el) => { if (el.closest(".hp, .sr-only, [hidden]") || el.matches(".skip-link")) return false; const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") return false; const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0) return false; if (el.tagName === "A" && cs.display === "inline" && el.parentElement.textContent.trim().length > el.textContent.trim().length + 3) return false; return r.width < 43.5 || r.height < 43.5; }).map((el) => (el.className || el.tagName).toString().split(" ")[0]).slice(0, 5) : [];
      return { sw: de.scrollWidth, vw, over, broken, small };
    }, w);
    ok(state.errors.length === 0 && m.sw <= m.vw && m.over.length === 0 && m.broken.length === 0 && m.small.length === 0, `${tag}: no errors, no overflow, images load${w <= 400 ? ", tap targets ok" : ""}`, `${state.errors.join("|")} sw=${m.sw}/${m.vw} ${m.over.join(",")} ${m.broken.join(",")} ${m.small.join(",")}`);
    await ctx.close();
  }
}

if (QUICK) { await browser.close(); server.close(); console.log(`\n${pass} passed, ${fail} failed`); failures.forEach((f) => console.log(" - " + f)); process.exit(fail ? 1 : 0); }

// ====================================================================== 2. home page weight, meta, JSON-LD, links
{
  const { ctx, page, state } = await newPage(browser, { width: 1440 });
  const sizes = new Map();
  page.on("response", async (r) => { try { const b = await r.body(); sizes.set(r.url(), b.length); } catch { /* ignore */ } });
  await goto(page, "/");
  const firstLoad = [...sizes.values()].reduce((a, b) => a + b, 0);
  await scrollAll(page);
  await page.waitForTimeout(500);
  const total = [...sizes.values()].reduce((a, b) => a + b, 0);
  ok(total < 1.5 * 1024 * 1024, `home: page weight after scrolling the whole page is under 1.5 MB`, `${(total / 1024).toFixed(0)} KB (first paint ${(firstLoad / 1024).toFixed(0)} KB)`);
  console.log(`      home weight: ${(firstLoad / 1024).toFixed(0)} KB on load, ${(total / 1024).toFixed(0)} KB after scrolling`);
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } }));
  ok(ld.length === 1 && ld[0] && ld[0]["@graph"].some((n) => n["@type"] === "Organization") && ld[0]["@graph"].some((n) => n["@type"] === "WebSite"), "home: JSON-LD Organization and WebSite parse");
  const third = await page.evaluate(() => [...new Set(performance.getEntriesByType("resource").map((r) => new URL(r.name).host))].filter((h) => h !== location.host));
  ok(third.length === 0 || third.every((h) => /github|firestore/.test(h)), "home: no third-party requests on load", third.join(", "));
  ok((await ctx.cookies()).length === 0, "home: sets no cookies");
  // every link on every page resolves (local) and the sprite icons exist
  const sprite = readFileSync(join(root, "assets/img/sprite.svg"), "utf8");
  for (const [name, path] of PAGES) {
    await goto(page, path);
    const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
    const uses = await page.evaluate(() => [...document.querySelectorAll("use")].map((u) => u.getAttribute("href").split("#")[1]));
    const locals = [...new Set(hrefs.filter((h) => h.startsWith(BASE)).map((h) => h.split("#")[0]))];
    let bad = [];
    for (const l of locals) { const r = await page.request.get(l); if (r.status() !== 200) bad.push(l + " " + r.status()); }
    ok(bad.length === 0, `${name}: every internal link opens`, bad.join(", "));
    const missing = [...new Set(uses)].filter((id) => !new RegExp(`id="${id}"`).test(sprite));
    ok(missing.length === 0, `${name}: every icon used exists in the sprite`, missing.join(", "));
    const ext = [...new Set(hrefs.filter((h) => !h.startsWith(BASE)))];
    ok(ext.every((h) => /^https:\/\/faxton-rentals\.web\.app(\/|$)|^mailto:|^tel:|^https:\/\/wa\.me\/|^https:\/\/www\.google\.com\/maps/.test(h)), `${name}: external links go only to the app (or configured contacts)`, ext.join(", "));
  }
  await ctx.close();
}

// ====================================================================== 3. header, mobile menu, keyboard
{
  const { ctx, page } = await newPage(browser, { width: 1440 });
  await goto(page, "/features/");
  ok(!(await page.$eval(".site-header", (h) => h.classList.contains("is-solid"))), "header: transparent at the top of the page");
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" })); await page.waitForTimeout(400);
  ok(await page.$eval(".site-header", (h) => h.classList.contains("is-solid")), "header: becomes solid after scrolling");
  const items = await page.$$eval(".nav-pill a", (a) => a.map((x) => x.textContent.trim()));
  ok(JSON.stringify(items) === JSON.stringify(["Home", "Features", "Contact us", "About us", "Billing"]), "header: the five nav items, in order", items.join(", "));
  ok((await page.$eval(".nav-pill a[aria-current=page]", (a) => a.textContent)) === "Features", "header: current page is marked");
  ok(!/login|sign in|home near me|homes for rent/i.test(await page.evaluate(() => document.body.innerText)), "no login, sign-in or marketplace nav anywhere on the page");
  // keyboard: skip link first, focus ring visible
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.keyboard.press("Tab"); await page.waitForTimeout(350);
  ok(await page.evaluate(() => document.activeElement?.classList.contains("skip-link")), "keyboard: the first Tab stop is the skip link");
  ok(await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom > 0; }), "keyboard: the skip link is visible when focused");
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { w: cs.outlineWidth, s: cs.outlineStyle }; });
  ok(ring.s !== "none" && parseFloat(ring.w) >= 2, "keyboard: focused links show a focus ring", JSON.stringify(ring));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(browser, { width: 390 });
  await goto(page, "/about/");
  ok(!(await page.isVisible(".nav-pill")), "mobile: desktop nav is hidden");
  ok(await page.isVisible(".menu-btn"), "mobile: menu button is visible");
  await page.screenshot({ path: join(OUT, "menu_closed_390.png") });
  await page.click(".menu-btn"); await page.waitForTimeout(450);
  ok(await page.isVisible("#mobile-menu"), "mobile menu: opens");
  ok((await page.getAttribute(".menu-btn", "aria-expanded")) === "true", "mobile menu: aria-expanded is true");
  const links = await page.$$eval("#mobile-menu nav a", (a) => a.map((x) => [x.textContent.trim(), Math.round(x.getBoundingClientRect().height)]));
  ok(JSON.stringify(links.map((l) => l[0])) === JSON.stringify(["Home", "Features", "Contact us", "About us", "Billing"]), "mobile menu: the same five items", links.map((l) => l[0]).join(", "));
  ok(links.every((l) => l[1] >= 44), "mobile menu: every item is at least 44px tall", JSON.stringify(links));
  ok((await page.textContent("#mobile-menu .btn-lime")).includes("Join the waitlist"), "mobile menu: has the Join the waitlist button");
  ok(await page.evaluate(() => document.getElementById("mobile-menu").contains(document.activeElement)), "mobile menu: focus moves inside");
  await page.screenshot({ path: join(OUT, "menu_open_390.png") });
  let inside = true; for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); inside = inside && (await page.evaluate(() => document.getElementById("mobile-menu").contains(document.activeElement))); }
  ok(inside, "mobile menu: Tab stays trapped inside the menu (12 presses)");
  inside = true; for (let i = 0; i < 4; i++) { await page.keyboard.press("Shift+Tab"); inside = inside && (await page.evaluate(() => document.getElementById("mobile-menu").contains(document.activeElement))); }
  ok(inside, "mobile menu: Shift+Tab also stays inside");
  ok(await page.evaluate(() => document.documentElement.classList.contains("nav-lock")), "mobile menu: page scroll is locked");
  await page.keyboard.press("Escape"); await page.waitForTimeout(450);
  ok(!(await page.isVisible("#mobile-menu")), "mobile menu: Escape closes it");
  ok(await page.evaluate(() => document.activeElement?.classList.contains("menu-btn")), "mobile menu: focus returns to the menu button");
  await page.click(".menu-btn"); await page.waitForTimeout(400);
  await page.click(".m-menu__close"); await page.waitForTimeout(450);
  ok(!(await page.isVisible("#mobile-menu")), "mobile menu: the close button works");
  await page.click(".menu-btn"); await page.waitForTimeout(400);
  await Promise.all([page.waitForURL("**/billing/"), page.click('#mobile-menu nav a:has-text("Billing")')]);
  ok(page.url().endsWith("/billing/"), "mobile menu: a link navigates");
  await ctx.close();
}

// ====================================================================== 4. waitlist
const fillWl = async (page, { name = "Ada Obi", email = "Ada.Obi@Example.com", role = "agent", city = "Abuja" } = {}) => {
  await page.fill("#wl-name", name); await page.fill("#wl-email", email); await page.selectOption("#wl-role", role); await page.fill("#wl-city", city);
};
for (const w of [1440, 390]) {
  const { ctx, page, state } = await newPage(browser, { width: w });
  await goto(page, "/");
  const f = (s) => `waitlist@${w}: ${s}`;
  ok((await page.inputValue("#wl-city")) === "Lagos", f("City defaults to Lagos"));
  ok((await page.$$eval("#ng-cities option", (o) => o.length)) > 30, f("city list has Nigerian cities"));
  ok((await page.$$eval("#wl-role option", (o) => o.map((x) => x.textContent))).join() === "Renter,Home owner,Agency,Agent", f("role options"));
  ok(await page.$eval('input[name="website"]', (e) => e.closest(".hp") !== null && e.tabIndex === -1), f("honeypot is hidden and not focusable"));
  // invalid
  await page.fill("#wl-email", "nope"); await page.click("[data-wl-form] button[type=submit]");
  ok((await page.textContent("#wl-name-err")).length > 0 && (await page.textContent("#wl-email-err")).length > 0, f("empty name and bad email show messages"));
  ok(await page.evaluate(() => document.activeElement?.id === "wl-name"), f("focus goes to the first invalid field"));
  ok(state.fsCalls.length === 0, f("nothing is sent when the form is invalid"));
  // success
  await fillWl(page); await page.click("[data-wl-form] button[type=submit]");
  await page.waitForSelector("[data-wl-done]:not([hidden])");
  const call = state.fsCalls[0];
  ok(state.fsCalls.length === 1 && call.method === "POST", f("exactly one POST is sent"));
  ok(call.url.startsWith("https://firestore.googleapis.com/v1/projects/faxton-rentals/databases/(default)/documents/waitlist?documentId=" + sha32("ada.obi@example.com") + "&key="), f("posts to waitlist with the SHA-256 document id"), call.url);
  const body = JSON.parse(call.body).fields;
  ok(Object.keys(body).sort().join() === "city,createdAt,email,name,role,source" && body.source.stringValue === "website" && body.role.stringValue === "agent" && body.email.stringValue === "ada.obi@example.com" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(body.createdAt.timestampValue), f("body has exactly the contract fields"), JSON.stringify(body));
  ok((await page.textContent("[data-wl-done] h2")).includes("You’re on the list"), f("success state says You're on the list"));
  ok((await page.$$eval("[data-wl-done] a, [data-wl-done] button", (e) => e.map((x) => x.textContent.trim()).join("|"))).match(/WhatsApp/) && (await page.$$eval("[data-wl-done] button", (e) => e.some((x) => /Copy link/.test(x.textContent)))), f("share on WhatsApp and copy link are offered"));
  const wa = await page.getAttribute("[data-wl-done] a.btn-lime", "href"); ok(/^https:\/\/wa\.me\/\?text=/.test(wa), f("WhatsApp link is a wa.me share link"), wa);
  await page.screenshot({ path: join(OUT, `waitlist_success_${w}.png`) });
  await ctx.grantPermissions?.(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.click("[data-wl-done] [data-copy]"); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector(".fx-toast")?.classList.contains("is-on")), f("copy link shows a confirmation"));
  // remembered on reload
  await page.reload({ waitUntil: "networkidle" });
  ok(await page.isVisible("[data-wl-done]") && !(await page.isVisible("[data-wl-form]")), f("after a reload this device remembers it already joined"));
  await page.click("[data-again]");
  ok(await page.isVisible("[data-wl-form]"), f("'Use a different email' brings the form back"));
  await ctx.close();
}
{
  // already exists, denied, network error, honeypot, throttle-free retries
  const cases = [["exists", "You’re already on the list"], ["denied", "couldn’t save that right now"], ["error", "couldn’t save that right now"], ["abort", "couldn’t save that right now"]];
  for (const [mode, expect] of cases) {
    const { ctx, page, state } = await newPage(browser, { width: 1440, firestore: mode });
    await goto(page, "/"); await fillWl(page, { role: "owner", email: "owner@example.com" });
    await page.click("[data-wl-form] button[type=submit]");
    await page.waitForTimeout(700);
    const text = await page.evaluate(() => document.querySelector("[data-wl-done]:not([hidden])")?.innerText || document.querySelector("[data-wl-status]")?.innerText || "");
    ok(text.includes(expect), `waitlist (${mode}): shows "${expect}"`, text.slice(0, 120));
    if (mode !== "exists") {
      ok(await page.isEnabled("[data-wl-form] button[type=submit]") && (await page.isVisible("[data-wl-form]")), `waitlist (${mode}): the form stays usable for a retry`);
      ok((await page.evaluate(() => document.querySelector("[data-wl-status]").innerHTML)).includes("Contact page"), `waitlist (${mode}): points to the Contact page when no support email is set`);
      state.firestore = "ok"; await page.click("[data-wl-form] button[type=submit]"); await page.waitForSelector("[data-wl-done]:not([hidden])", { timeout: 4000 }).catch(() => {});
      ok(await page.isVisible("[data-wl-done]"), `waitlist (${mode}): a retry succeeds once the service is back`);
    } else ok(await page.evaluate(() => !localStorage.getItem("fxr.joined") === false), "waitlist (exists): remembered on this device");
    await ctx.close();
  }
  const { ctx, page, state } = await newPage(browser, { width: 1440 });
  await goto(page, "/"); await fillWl(page);
  await page.evaluate(() => { document.querySelector('input[name="website"]').value = "http://spam.example"; });
  await page.click("[data-wl-form] button[type=submit]"); await page.waitForTimeout(400);
  ok(state.fsCalls.length === 0, "waitlist (honeypot): a filled honeypot sends nothing");
  await page.evaluate(() => localStorage.clear());
  await goto(page, "/?role=agency#waitlist");
  ok((await page.inputValue("#wl-role")) === "agency", "waitlist: ?role=agency preselects the role");
  await goto(page, "/");
  await page.click('a[data-role="owner"]'); await page.waitForTimeout(600);
  ok((await page.inputValue("#wl-role")) === "owner", "waitlist: the 'Join as an owner' button sets the role");
  await ctx.close();
}

// ====================================================================== 5. contact form and info cards
{
  const { ctx, page, state } = await newPage(browser, { width: 1440 });
  await goto(page, "/contact/");
  let cards = await page.$$eval("[data-info] .icard", (c) => c.map((x) => x.innerText.replace(/\s+/g, " ").trim()));
  ok(cards.length === 2 && /Lagos, Nigeria/.test(cards[0]) && /Help centre/.test(cards[1]), "contact: with no config only 'Lagos, Nigeria' and the Help centre show", cards.join(" | "));
  ok((await page.getAttribute("[data-info] a.icard", "href")) === "https://faxton-rentals.web.app/#/help", "contact: Help centre links to APP_URL/#/help");
  ok(!/\+?\d[\d\s]{8,}|@[a-z]+\./i.test(cards.join(" ")), "contact: no invented phone numbers or email addresses");
  // invalid
  await page.click("[data-contact-form] button[type=submit]");
  ok((await page.$$eval("[data-contact-form] .field-err", (e) => e.filter((x) => x.textContent.trim()).length)) === 4, "contact: all four fields report problems when empty");
  ok(state.fsCalls.length === 0, "contact: nothing sent when invalid");
  // counter
  await page.fill("#c-message", "Hello there"); ok((await page.textContent("[data-counter]")).startsWith("11 /"), "contact: message counter updates");
  // success
  await page.fill("#c-name", "Ada Obi"); await page.fill("#c-email", "ada@example.com"); await page.selectOption("#c-subject", "List my property"); await page.fill("#c-message", "I would like to list two flats in Lekki when you launch.");
  await page.click("[data-contact-form] button[type=submit]"); await page.waitForSelector("[data-contact-sent]:not([hidden])");
  const c = state.fsCalls[0]; const fields = JSON.parse(c.body).fields;
  ok(c.url.includes("/documents/siteMessages?key=") && !c.url.includes("documentId"), "contact: posts to siteMessages without a document id", c.url);
  ok(Object.keys(fields).sort().join() === "createdAt,email,message,name,source,subject" && fields.subject.stringValue === "List my property" && fields.source.stringValue === "website", "contact: body has exactly the contract fields", JSON.stringify(fields).slice(0, 160));
  ok((await page.textContent("[data-contact-sent] h2")) === "Message sent", "contact: success state");
  await page.screenshot({ path: join(OUT, "contact_success_1440.png"), fullPage: true });
  // throttle: sending again straight away is held back
  await page.click("[data-contact-sent] [data-again]");
  await page.fill("#c-name", "Ada Obi"); await page.fill("#c-email", "ada@example.com"); await page.selectOption("#c-subject", "Support"); await page.fill("#c-message", "A second message right away, please.");
  await page.click("[data-contact-form] button[type=submit]"); await page.waitForTimeout(300);
  ok(state.fsCalls.length === 1 && /wait \d+ seconds/.test(await page.textContent("[data-contact-status]")), "contact: a second message within 30 seconds is held back politely", await page.textContent("[data-contact-status]"));
  // after the gap it goes through
  await page.evaluate(() => localStorage.setItem("fxr.lastMessage", String(Date.now() - 31000)));
  await page.reload({ waitUntil: "networkidle" });
  await page.fill("#c-name", "Ada Obi"); await page.fill("#c-email", "ada@example.com"); await page.selectOption("#c-subject", "Support"); await page.fill("#c-message", "A second message after the pause, please.");
  await page.click("[data-contact-form] button[type=submit]"); await page.waitForSelector("[data-contact-sent]:not([hidden])", { timeout: 4000 }).catch(() => {});
  ok(state.fsCalls.length === 2, "contact: after 30 seconds the next message is sent");
  await ctx.close();
}
for (const mode of ["denied", "abort", "error"]) {
  const { ctx, page } = await newPage(browser, { width: 390, firestore: mode });
  await goto(page, "/contact/");
  await page.fill("#c-name", "Ada Obi"); await page.fill("#c-email", "ada@example.com"); await page.selectOption("#c-subject", "Press"); await page.fill("#c-message", "Is anyone there? This is a test message.");
  await page.click("[data-contact-form] button[type=submit]"); await page.waitForTimeout(700);
  const s = await page.textContent("[data-contact-status]");
  ok(/couldn’t save that right now/.test(s) && (await page.isVisible("[data-contact-form]")) && (await page.isEnabled("[data-contact-form] button[type=submit]")), `contact (${mode}): friendly error and the form stays usable`, s);
  await ctx.close();
}
{
  const { ctx, page, state } = await newPage(browser, { width: 1440 });
  await goto(page, "/contact/");
  await page.fill("#c-name", "Bot"); await page.fill("#c-email", "bot@example.com"); await page.selectOption("#c-subject", "Other"); await page.fill("#c-message", "Buy cheap watches now please thanks");
  await page.evaluate(() => { document.querySelector('[data-contact-form] input[name="website"]').value = "x"; });
  await page.click("[data-contact-form] button[type=submit]"); await page.waitForTimeout(400);
  ok(state.fsCalls.length === 0, "contact (honeypot): a filled honeypot sends nothing");
  await ctx.close();
}
{
  const cfg = { SUPPORT_EMAIL: "help@example.org", PHONE: "+234 800 000 0000", WHATSAPP: "234 800 000 0001", ADDRESS: "1 Example Road, Lekki, Lagos", APP_URL: "https://app.example.org", SOCIALS: { instagram: "https://instagram.com/faxton", linkedin: "", x: "", youtube: "", tiktok: "", pinterest: "" }, RELEASES_REPO: REPO };
  const { ctx, page } = await newPage(browser, { width: 1440, config: cfg });
  await goto(page, "/contact/");
  const cards = await page.$$eval("[data-info] .icard", (c) => c.map((x) => x.innerText.replace(/\s+/g, " ").trim()));
  ok(cards.length === 6 && /Email.*help@example.org/.test(cards[0]) && /Phone/.test(cards[1]) && /WhatsApp/.test(cards[2]) && /Our office.*Lekki/.test(cards[3]), "contact: with a config the Email, Phone, WhatsApp and Office cards appear", cards.join(" | "));
  const hrefs = await page.$$eval("[data-info] a.icard", (a) => a.map((x) => x.getAttribute("href")));
  ok(hrefs.includes("mailto:help@example.org") && hrefs.includes("tel:+2348000000000") && hrefs.includes("https://wa.me/2348000000001") && hrefs.includes("https://app.example.org/#/help"), "contact: card links are mailto:, tel:, wa.me and the configured app", hrefs.join(", "));
  ok((await page.$eval('a[data-social="instagram"]', (a) => a.href)).startsWith("https://instagram.com/faxton") && (await page.$eval('a[data-social="instagram"]', (a) => a.target)) === "_blank", "footer: a configured social address becomes a real link");
  ok((await page.$eval('.sf-links a[data-app="/#/privacy"]', (a) => a.href)) === "https://app.example.org/#/privacy", "footer: legal links follow APP_URL");
  await page.screenshot({ path: join(OUT, "contact_configured_1440.png"), fullPage: true });
  await ctx.close();
}

// ====================================================================== 6. footer
{
  const { ctx, page } = await newPage(browser, { width: 1440 });
  await goto(page, "/");
  const labels = await page.$$eval(".sf-links a, .sf-links button", (e) => e.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
  ok(labels.join("|") === "Support|Privacy|Terms of Use|License|Your Privacy Choices|Get the app", "footer: Support, Privacy, Terms of Use, License, Your Privacy Choices, Get the app", labels.join("|"));
  ok((await page.$$eval(".sf-social a", (a) => a.length)) === 6, "footer: six social icons");
  const legal = await page.$$eval('.sf-links a[data-app]', (a) => a.map((x) => x.getAttribute("href")));
  ok(legal.join() === "https://faxton-rentals.web.app/#/help,https://faxton-rentals.web.app/#/privacy,https://faxton-rentals.web.app/#/terms,https://faxton-rentals.web.app/#/license", "footer: legal links go to the app's pages", legal.join());
  await page.click('a[data-social="instagram"]'); await page.waitForTimeout(300);
  ok(/Instagram page is coming soon/.test(await page.textContent(".fx-toast")), "footer: an empty social address shows a 'coming soon' toast");
  const yr = await page.textContent("[data-year]"); ok(yr === String(new Date().getFullYear()), "footer: current year", yr);
  ok(/Faxton Rentals Inc\. All rights reserved/.test(await page.textContent(".sf-brand small")) && /Version \S+/.test(await page.textContent(".sf-ver")), "footer: © line and version string");
  await page.click("[data-choices]"); await page.waitForTimeout(250);
  ok(await page.isVisible("#privacy-dialog"), "footer: Your Privacy Choices opens a window");
  ok(/no ads|doesn’t show ads/i.test(await page.textContent("#privacy-dialog")) && /tracking cookies/.test(await page.textContent("#privacy-dialog")), "privacy window: says no ads and no tracking cookies");
  await page.screenshot({ path: join(OUT, "privacy_1440.png") });
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  ok(!(await page.isVisible("#privacy-dialog")), "privacy window: Escape closes it");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForSelector("#download-dialog");
  await page.click("a[data-get-app]"); await page.waitForTimeout(250);
  ok(await page.$eval("#download-dialog", (dialog) => dialog.open), "footer: 'Get the app' opens the shared device modal from any page");
  await page.keyboard.press("Escape");
  await ctx.close();
}

// ====================================================================== 7. shared device-download modal and Features platform strip
const GROUP_TITLES = { android: "Choose Android package", ios: "Install on iPhone", windows: "Choose Windows package", mac: "Choose Mac package", linux: "Choose Linux package" };
const EXPECT = { android: ["Faxton-Rentals-Android.apk", "Faxton-Rentals-Android-x64.apk", "Faxton-Rentals-Android.aab"], windows: ["Faxton-Rentals-Windows-x64.exe", "Faxton-Rentals-Windows-arm64.exe"], mac: ["Faxton-Rentals-Mac-arm64.dmg", "Faxton-Rentals-Mac-x64.dmg"], linux: ["Faxton-Rentals-Linux-x64.AppImage", "Faxton-Rentals-Linux-arm64.AppImage", "Faxton-Rentals-Linux-x64.deb", "Faxton-Rentals-Linux-arm64.deb"] };
for (const w of [1440, 390]) {
  const { ctx, page, state } = await newPage(browser, { width: w });
  await goto(page, "/");
  await page.waitForSelector("#download-dialog");
  ok((await page.textContent(".dl--compact h2")) === "Start exploring on your device.", `download@${w}: compact homepage CTA remains`);
  ok((await page.$$(".dlx-card")).length === 0, `download@${w}: platform strip is no longer duplicated on Home`);
  await page.click("[data-dl-now]"); await page.waitForTimeout(1200);
  ok(await page.$eval("#download-dialog", (dialog) => dialog.open), `download@${w}: Download now opens a modal`);
  const names = await page.$$eval(".dl-modal-card", (cards) => cards.map((x) => x.querySelector("b")?.textContent));
  ok(names.join("|") === "Website|Android|iOS|Windows|macOS|Linux", `download@${w}: modal has all six platforms`, names.join("|"));
  ok((await page.$eval('.dl-modal-card[href]', (a) => a.href)) === "https://faxton-rentals.web.app/", `download@${w}: Website opens the configured app`);
  for (const gid of ["android", "ios", "windows", "mac", "linux"]) {
    await page.click(`.dl-modal-card[data-modal-platform="${gid}"]`);
    await page.waitForTimeout(350);
    const title = await page.textContent(".dl-modal__details .dlx-sheet header b");
    ok(title === GROUP_TITLES[gid], `download@${w}: ${gid} opens the correct package list`, title);
    if (gid === "ios") {
      ok(await page.isVisible(".dl-modal__details [data-safari]"), `download@${w}: iOS offers Add to Home Screen`);
      await page.click(".dl-modal__details [data-safari]");
      ok(/Safari/.test(await page.textContent(".dl-modal__details .dlx-how")) && /Add to Home Screen/.test(await page.textContent(".dl-modal__details .dlx-how")), `download@${w}: iOS instructions mention Safari and Add to Home Screen`);
      await page.click(`.dl-modal-card[data-modal-platform="ios"]`);
      await page.waitForTimeout(250);
      const links = await page.$$eval(".dl-modal__details .dlx-sheet a.dlx-opt", (a) => a.map((x) => x.getAttribute("href")));
      ok(links.length === 1 && links[0].endsWith("Faxton-Rentals-iPhone-unsigned.ipa") && links[0].startsWith(`https://github.com/${REPO}/releases/download/v1.2.3/`), `download@${w}: iOS package link comes from the latest release`, links.join());
    } else {
      const links = await page.$$eval(".dl-modal__details .dlx-opt[href]", (a) => a.map((x) => x.getAttribute("href").split("/").pop()));
      ok(JSON.stringify(links) === JSON.stringify(EXPECT[gid]), `download@${w}: ${gid} options are the real release files`, links.join(", "));
      const sub = await page.$eval(".dl-modal__details .dlx-ot small", (e) => e.textContent);
      ok(/v1\.2\.3/.test(sub) && /MB/.test(sub), `download@${w}: ${gid} shows version and size`, sub);
    }
  }
  ok(state.ghCalls === 1, `download@${w}: GitHub release data is requested once`, String(state.ghCalls));
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok(!(await page.$eval("#download-dialog", (dialog) => dialog.open)), `download@${w}: Escape closes the modal`);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(browser, { width: 1440, github: "partial" });
  await goto(page, "/"); await page.waitForSelector("#download-dialog");
  await page.click("[data-dl-now]"); await page.waitForTimeout(700);
  await page.click('.dl-modal-card[data-modal-platform="android"]'); await page.waitForTimeout(200);
  const t = await page.$$eval(".dl-modal__details .dlx-opt", (o) => o.map((x) => [x.tagName, x.innerText.replace(/\s+/g, " ")]));
  ok(t[0][0] === "A" && t[1][0] === "DIV" && /Not available yet/.test(t[1][1]) && /Not available yet/.test(t[2][1]), "download: files missing from the release show 'Not available yet'", JSON.stringify(t));
  await page.click('.dl-modal-card[data-modal-platform="mac"]'); await page.waitForTimeout(150);
  ok((await page.$$eval(".dl-modal__details .dlx-opt.off", (o) => o.length)) === 2, "download: macOS options are 'Not available yet' when the release has none");
  await ctx.close();
}
{
  const { ctx, page } = await newPage(browser, { width: 1440, github: "404" });
  await goto(page, "/"); await page.waitForSelector("#download-dialog");
  await page.click("[data-dl-now]"); await page.waitForTimeout(700);
  await page.click('.dl-modal-card[data-modal-platform="windows"]'); await page.waitForTimeout(250);
  ok((await page.$$eval(".dl-modal__details .dlx-opt.off", (o) => o.length)) === 2 && /Not available yet/.test(await page.textContent(".dl-modal__details")), "download: no release published yet -> 'Not available yet'");
  await ctx.close();
}
{
  const { ctx, page, state } = await newPage(browser, { width: 1440, github: "abort" });
  await goto(page, "/"); await page.waitForSelector("#download-dialog");
  await page.click("[data-dl-now]"); await page.waitForTimeout(700);
  await page.click('.dl-modal-card[data-modal-platform="windows"]'); await page.waitForTimeout(300);
  ok(/Couldn’t reach the download server/.test(await page.textContent(".dl-modal__details")) && (await page.isVisible(".dl-modal__details [data-retry]")), "download: GitHub unreachable -> clear message and a retry button");
  state.github = "ok"; await page.click(".dl-modal__details [data-retry]"); await page.waitForTimeout(700);
  ok((await page.$$eval(".dl-modal__details .dlx-opt[href]", (a) => a.length)) === 2, "download: Try again loads the files once GitHub is back");
  await ctx.close();
}
{
  const UAS = {
    android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
  for (const [gid, ua] of Object.entries(UAS)) {
    const mobile = gid === "android" || gid === "ios";
    const { ctx, page } = await newPage(browser, { width: mobile ? 390 : 1440, ua, mobile });
    await goto(page, "/");
    await page.waitForSelector("#download-dialog");
    ok(await page.$eval(`.dl-modal-card[data-modal-platform="${gid}"]`, (e) => e.classList.contains("hot")), `Download modal highlights ${gid} visitors`);
    await page.click("[data-dl-now]"); await page.waitForTimeout(300);
    ok((await page.$$eval(".dl-modal-card", (cards) => cards.length)) === 5 + 1, `Download now (${gid}): shows the full device picker`);
    await page.click(`.dl-modal-card[data-modal-platform="${gid}"]`);
    await page.waitForTimeout(200);
    ok((await page.textContent(".dl-modal__details .dlx-sheet header b")) === GROUP_TITLES[gid], `Download now (${gid}): opens the correct platform options`);
    await ctx.close();
  }
  const { ctx, page } = await newPage(browser, { width: 820 });
  await goto(page, "/features/");
  ok(await page.isVisible(".frf-platform-grid"), "features: platform strip appears below messaging phone preview");
  ok((await page.$$eval(".frf-platform-card", (cards) => cards.length)) === 6, "features: six platform cards appear");
  const phoneBox = await page.locator(".frf-device--chat .frf-phone").boundingBox();
  const captionBox = await page.locator(".frf-demo-caption").boundingBox();
  ok(captionBox.y >= phoneBox.y + phoneBox.height - 1, "features: interactive preview caption sits below phone frame");
  await page.click('[data-open-download][data-group="android"]');
  await page.waitForTimeout(250);
  ok(await page.$eval("#download-dialog", (dialog) => dialog.open), "features: platform cards open the download modal");
  ok((await page.textContent(".dl-modal__details .dlx-sheet header b")) === GROUP_TITLES.android, "features: platform shortcut opens the matching Android options");
  await goto(page, "/about/");
  ok(await page.isVisible(".dl--mini"), "about: has a compact download call-to-action");
  ok((await page.$$(".dlx-card")).length === 0, "about: does not repeat the device platform strip");
  await ctx.close();
}

// ====================================================================== 8. motion preferences, 404, no-JS
{
  const { ctx, page } = await newPage(browser, { width: 1440, reduced: true });
  await goto(page, "/features/");
  const hidden = await page.evaluate(() => [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity !== "1").length);
  ok(hidden === 0, "reduced motion: every reveal element is visible immediately", String(hidden));
  ok((await page.evaluate(() => getComputedStyle(document.querySelector(".hero__bg img")).animationName)) === "none", "reduced motion: the hero photo does not animate");
  await ctx.close();
}
{
  const { ctx, page } = await newPage(browser, { width: 1440 });
  const res = await page.goto(BASE + "/does/not/exist", { waitUntil: "networkidle" });
  ok(res.status() === 404 && /We couldn’t find that page/.test(await page.textContent("main")), "404: an unknown address shows the friendly 404 page", String(res.status()));
  ok((await page.$$eval(".nav-pill a", (a) => a.length)) === 5 && await page.isVisible("h1"), "404: has the header and a heading");
  const logo = await page.$eval(".logo", (a) => a.href); ok(logo === BASE + "/", "404: logo link resolves from any depth (base href)", logo);
  await ctx.close();
  const ctx2 = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p2 = await ctx2.newPage(); await p2.goto(BASE + "/", { waitUntil: "load" });
  ok((await p2.evaluate(() => [...document.querySelectorAll(".reveal")].filter((e) => getComputedStyle(e).opacity === "0").length)) === 0, "no JavaScript: content is still visible");
  ok(await p2.isVisible("h1") && await p2.isVisible(".site-foot"), "no JavaScript: headline and footer render");
  await p2.screenshot({ path: join(OUT, "home_nojs_1280.png") });
  await ctx2.close();
}

await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFailures:"); failures.forEach((f) => console.log(" - " + f)); }
writeFileSync(join(OUT, "result.txt"), `${pass} passed, ${fail} failed\n${failures.join("\n")}\n`);
process.exit(fail ? 1 : 0);
