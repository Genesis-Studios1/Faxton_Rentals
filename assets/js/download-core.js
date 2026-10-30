// The app downloads: which packages exist, how to find them in the latest GitHub release, and how to guess
// the visitor's device. No DOM in here, so it can be tested in Node (tests/download.test.mjs).
// Ported from the Faxton Rentals app (public/js/apps.js: GROUPS, PLATFORMS, githubLatest).

// [key, exact file name in the release, fallback pattern used if the exact name is not there]
export const PACKAGES = [
  ["android", "Faxton-Rentals-Android.apk", /android(?!.*(x64|x86))[^/]*\.apk$/i],
  ["android_x64", "Faxton-Rentals-Android-x64.apk", /android.*(x64|x86)[^/]*\.apk$/i],
  ["android_aab", "Faxton-Rentals-Android.aab", /\.aab$/i],
  ["iphone", "Faxton-Rentals-iPhone-unsigned.ipa", /\.ipa$/i],
  ["windows_x64", "Faxton-Rentals-Windows-x64.exe", /win[^/]*x64[^/]*\.exe$/i],
  ["windows_arm64", "Faxton-Rentals-Windows-arm64.exe", /win[^/]*arm64[^/]*\.exe$/i],
  ["mac_arm64", "Faxton-Rentals-Mac-arm64.dmg", /mac[^/]*arm64[^/]*\.dmg$/i],
  ["mac_x64", "Faxton-Rentals-Mac-x64.dmg", /mac[^/]*x64[^/]*\.dmg$/i],
  ["linux_x64", "Faxton-Rentals-Linux-x64.AppImage", /linux[^/]*(?:x64|x86_64)[^/]*\.appimage$/i],
  ["linux_arm64", "Faxton-Rentals-Linux-arm64.AppImage", /linux[^/]*arm64[^/]*\.appimage$/i],
  ["linux_x64_deb", "Faxton-Rentals-Linux-x64.deb", /linux[^/]*x64[^/]*\.deb$/i],
  ["linux_arm64_deb", "Faxton-Rentals-Linux-arm64.deb", /linux[^/]*arm64[^/]*\.deb$/i],
];

// The five cards. opts: [package key (or "#safari"), tag, title, one line]
export const GROUPS = [
  { id: "android", name: "Android", sub: "Get the app", img: "os-android.webp", title: "Choose Android package", opts: [["android", "APK", "Download .APK", "For direct installation"], ["android_x64", "APK", "Download .APK · x64", "For Intel/x86 devices and emulators"], ["android_aab", "AAB", "Download .AAB", "For developers (Play Store)"]] },
  { id: "ios", name: "iOS", sub: "Get the app", img: "os-apple.webp", title: "Install on iPhone", opts: [["#safari", "WEB", "Add to Home Screen", "Easiest: open the web app in Safari"], ["iphone", "IPA", "Download .IPA", "Sideload with AltStore or Sideloadly"]] },
  { id: "windows", name: "Windows", sub: "Use on desktop", img: "os-windows.webp", title: "Choose Windows package", opts: [["windows_x64", "EXE", "Windows x64", "Intel and AMD PCs (most computers)"], ["windows_arm64", "EXE", "Windows ARM64", "Snapdragon and other ARM PCs"]] },
  { id: "mac", name: "macOS", sub: "Use on MacBook", title: "Choose Mac package", opts: [["mac_arm64", "DMG", "Apple Silicon (arm64)", "M1, M2, M3 and M4 MacBooks"], ["mac_x64", "DMG", "Intel (x64)", "Older Intel MacBooks"]] },
  { id: "linux", name: "Linux", sub: "Use on desktop", title: "Choose Linux package", opts: [["linux_x64", "APPIMG", "AppImage · x64", "Runs on most distributions"], ["linux_arm64", "APPIMG", "AppImage · ARM64", "Raspberry Pi and other ARM64"], ["linux_x64_deb", "DEB", "Debian/Ubuntu · x64", "Install with apt"], ["linux_arm64_deb", "DEB", "Debian/Ubuntu · ARM64", "Install with apt"]] },
];

export const releaseUrl = (repo) => `https://api.github.com/repos/${repo}/releases/latest`;
export const downloadPrefix = (repo) => `https://github.com/${repo}/releases/download/`;

export const fmtSize = (n) => (n > 0 ? (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB" : "");
const vparts = (v) => String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
export const isNewer = (a, b) => { const x = vparts(a), y = vparts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

// Turn the GitHub API answer into { version, notes, page, files: { key: { url, name, size } } }.
// Only links that really point into this repository's release downloads are kept.
export function parseRelease(json, repo) {
  if (!json || typeof json !== "object" || json.draft) return null;
  const assets = Array.isArray(json.assets) ? json.assets : [];
  const prefix = downloadPrefix(repo).toLowerCase();
  const ok = (a) => a && typeof a.name === "string" && typeof a.browser_download_url === "string" && a.browser_download_url.toLowerCase().startsWith(prefix);
  const usable = assets.filter(ok);
  const used = new Set();
  const files = {};
  // exact names first, so a loose pattern can never steal another package's file
  for (const [key, exact] of PACKAGES) {
    const a = usable.find((x) => x.name === exact);
    if (a) { files[key] = { url: a.browser_download_url, name: a.name, size: +a.size || 0 }; used.add(a); }
  }
  for (const [key, , re] of PACKAGES) {
    if (files[key]) continue;
    const a = usable.find((x) => !used.has(x) && re.test(x.name));
    if (a) { files[key] = { url: a.browser_download_url, name: a.name, size: +a.size || 0 }; used.add(a); }
  }
  return {
    version: String(json.tag_name || json.name || "").replace(/^v/i, ""),
    notes: typeof json.body === "string" ? json.body.slice(0, 600) : "",
    page: typeof json.html_url === "string" && json.html_url.startsWith("https://github.com/") ? json.html_url : "",
    files,
  };
}

// Which card to highlight for this device.
export function detectGroup(ua = "", touchPoints = 0) {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return "ios"; // iPadOS reports as a Mac
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  if (/Linux|X11|CrOS/i.test(ua)) return "linux";
  return "";
}

export const CACHE_MS = 15 * 60 * 1000;
// Fetch the latest release. Resolves to { state: "ok" | "none" | "offline", release, stale }.
//  ok      release found (fresh from GitHub, or the last one we saw if GitHub is unreachable: stale = true)
//  none    GitHub answered 404: no release has been published yet
//  offline could not reach GitHub and there is nothing saved
export async function loadLatest({ repo, fetchImpl = globalThis.fetch, storage = null, now = Date.now(), force = false, timeoutMs = 8000 }) {
  const read = () => { try { const c = JSON.parse(storage?.get("fxr.release") || "null"); return c && c.repo === repo && c.data ? c : null; } catch { return null; } };
  const cached = read();
  if (cached && !force && now - cached.t < CACHE_MS) return { state: "ok", release: cached.data, stale: false };
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(releaseUrl(repo), { headers: { Accept: "application/vnd.github+json" }, credentials: "omit", referrerPolicy: "no-referrer", ...(ctl ? { signal: ctl.signal } : {}) });
    if (res.status === 404) return { state: "none", release: null, stale: false };
    if (!res.ok) throw new Error("GitHub " + res.status);
    const release = parseRelease(await res.json(), repo);
    if (!release) return { state: "none", release: null, stale: false };
    try { storage?.set("fxr.release", JSON.stringify({ t: now, repo, data: release })); } catch { /* storage is optional */ }
    return { state: "ok", release, stale: false };
  } catch {
    // If GitHub's unauthenticated API is rate-limited or unreachable, use the
    // same-origin release manifest shipped with this site.
    try {
      const fallbackUrl = new URL("../release-manifest.json", import.meta.url).href;
      const fallback = await fetchImpl(fallbackUrl, {
        method: "GET",
        cache: "no-cache",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (fallback.ok) {
        const release = parseRelease(await fallback.json(), repo);
        if (release) {
          try { storage?.set("fxr.release", JSON.stringify({ t: now, repo, data: release })); } catch { /* storage is optional */ }
          return { state: "ok", release, stale: true };
        }
      }
    } catch { /* fall through to the saved browser copy or offline state */ }
    if (cached) return { state: "ok", release: cached.data, stale: true };
    return { state: "offline", release: null, stale: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
