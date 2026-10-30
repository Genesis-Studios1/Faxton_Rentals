// Run with: node tests/download.test.mjs   (Node 18+; no packages needed)
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PACKAGES, GROUPS, parseRelease, detectGroup, fmtSize, isNewer, loadLatest, releaseUrl } from "../assets/js/download-core.js";

test("Download now attaches its click handler to all matching buttons", () => { const source = readFileSync(new URL("../assets/js/download.js", import.meta.url), "utf8"); assert.ok(source.includes('$$("[data-dl-now]", root.closest("[data-download]") || root).forEach')); });

const REPO = "musazaneerah4-crypto/Faxton-Rentals-Downloads";
const dl = (name, size = 5_000_000) => ({ name, size, browser_download_url: `https://github.com/${REPO}/releases/download/v1.2.0/${name}` });
const release = (names) => ({ tag_name: "v1.2.0", html_url: `https://github.com/${REPO}/releases/tag/v1.2.0`, body: "Notes", assets: names.map((n) => dl(n)) });

test("every package in a picker card exists in the package list", () => {
  const keys = new Set(PACKAGES.map((p) => p[0]));
  for (const g of GROUPS) for (const [k] of g.opts) assert.ok(k === "#safari" || keys.has(k), `${g.id}: ${k}`);
  assert.deepEqual(GROUPS.map((g) => g.id), ["android", "ios", "windows", "mac", "linux"]);
});

test("parseRelease maps the exact file names the app uses", () => {
  const r = parseRelease(release(PACKAGES.map((p) => p[1])), REPO);
  assert.equal(r.version, "1.2.0");
  assert.equal(Object.keys(r.files).length, PACKAGES.length);
  assert.equal(r.files.windows_x64.name, "Faxton-Rentals-Windows-x64.exe");
  assert.equal(r.files.android.name, "Faxton-Rentals-Android.apk");
  assert.equal(r.files.android_x64.name, "Faxton-Rentals-Android-x64.apk");
});

test("parseRelease falls back to patterns and never mixes up architectures", () => {
  const r = parseRelease(release(["faxton-android-x64-release.apk", "faxton-android-release.apk", "Faxton Rentals-Mac-arm64.dmg", "Faxton_Windows_arm64_setup.exe"]), REPO);
  assert.equal(r.files.android.name, "faxton-android-release.apk");
  assert.equal(r.files.android_x64.name, "faxton-android-x64-release.apk");
  assert.equal(r.files.mac_arm64.name, "Faxton Rentals-Mac-arm64.dmg");
  assert.equal(r.files.windows_arm64.name, "Faxton_Windows_arm64_setup.exe");
  assert.equal(r.files.windows_x64, undefined);   // not published: stays "Not available yet"
  assert.equal(r.files.iphone, undefined);
});

test("parseRelease recognises the published Linux x86_64 AppImage", () => {
  const r = parseRelease(release(["Faxton-Rentals-Linux-x86_64.AppImage"]), REPO);
  assert.equal(r.files.linux_x64.name, "Faxton-Rentals-Linux-x86_64.AppImage");
});

test("parseRelease ignores links that do not point into the repository's release downloads", () => {
  const evil = { tag_name: "v9", assets: [{ name: "Faxton-Rentals-Android.apk", size: 1, browser_download_url: "https://evil.example/Faxton-Rentals-Android.apk" }] };
  assert.deepEqual(parseRelease(evil, REPO).files, {});
  assert.equal(parseRelease(null, REPO), null);
  assert.equal(parseRelease({ draft: true }, REPO), null);
});

test("detectGroup", () => {
  assert.equal(detectGroup("Mozilla/5.0 (Linux; Android 14; Pixel 8)"), "android");
  assert.equal(detectGroup("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), "ios");
  assert.equal(detectGroup("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "ios");   // iPad
  assert.equal(detectGroup("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "mac");
  assert.equal(detectGroup("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(detectGroup("Mozilla/5.0 (X11; Linux x86_64)"), "linux");
  assert.equal(detectGroup("curl/8"), "");
});

test("helpers", () => {
  assert.equal(fmtSize(0), "");
  assert.equal(fmtSize(5 * 1048576), "5.0 MB");
  assert.equal(fmtSize(80 * 1048576), "80 MB");
  assert.ok(isNewer("1.10.0", "1.9.9"));
  assert.ok(!isNewer("1.2.0", "1.2.0"));
});

test("loadLatest: ok, cached, stale fallback, none and offline", async () => {
  const mem = new Map();
  const storage = { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v) };
  let calls = 0;
  const good = async (url) => { calls++; assert.equal(url, releaseUrl(REPO)); return { ok: true, status: 200, json: async () => release(PACKAGES.map((p) => p[1])) }; };
  const a = await loadLatest({ repo: REPO, fetchImpl: good, storage, now: 1000 });
  assert.equal(a.state, "ok"); assert.equal(a.stale, false); assert.equal(calls, 1);
  const b = await loadLatest({ repo: REPO, fetchImpl: good, storage, now: 2000 });      // fresh cache: no new request
  assert.equal(b.state, "ok"); assert.equal(calls, 1);
  const down = async () => { throw new TypeError("offline"); };
  const c = await loadLatest({ repo: REPO, fetchImpl: down, storage, now: 1000 + 16 * 60 * 1000 }); // cache expired, GitHub unreachable
  assert.equal(c.state, "ok"); assert.equal(c.stale, true);
  const none = await loadLatest({ repo: REPO, fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }), storage: null, now: 5 });
  assert.equal(none.state, "none");
  const off = await loadLatest({ repo: REPO, fetchImpl: down, storage: null, now: 5 });
  assert.equal(off.state, "offline");
  const limited = await loadLatest({ repo: REPO, fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }), storage: null, now: 5 });
  assert.equal(limited.state, "offline");   // rate limited counts as unreachable
});
