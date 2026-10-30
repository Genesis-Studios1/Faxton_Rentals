// The "Get Faxton Rentals everywhere" section: five device cards that open a picker with the real files
// from the latest GitHub release (or clear "not available yet" states).
import { CONFIG } from "./config.js";
import { GROUPS, detectGroup, fmtSize, loadLatest } from "./download-core.js";
import { $, $$, esc, icon, store, focusables } from "./ui.js";

const mobile = () => window.matchMedia("(max-width: 700px)").matches;
let latest = { phase: "loading", release: null, stale: false };
let loading = null;

function load(force = false) {
  latest = { ...latest, phase: "loading" };
  notify();
  loading = loadLatest({ repo: CONFIG.RELEASES_REPO, storage: store, force }).then((r) => {
    latest = { phase: r.state, release: r.release, stale: r.stale };
    notify();
    return latest;
  });
  return loading;
}
const listeners = new Set();
const mountedRoots = new WeakSet();
let activeOpenDetected = null;
const notify = () => listeners.forEach((f) => f());

// Keep document-level listeners single-instance when the router revisits the download panel.
document.addEventListener("fx:pagewillchange", () => { listeners.clear(); activeOpenDetected = null; });
document.addEventListener("fx:open-download", () => activeOpenDetected?.());
document.addEventListener("click", (event) => {
  if (event.target.closest?.(".dlx-head, [data-dl-now]")) load();
}, { capture: true });

function sheetHtml(g) {
  const { phase, release, stale } = latest;
  const rows = g.opts.map(([key, tag, name, sub]) => {
    if (key === "#safari") return `<button type="button" class="dlx-opt" data-safari><span class="dlx-file">${tag}</span><span class="dlx-ot"><b>${esc(name)}</b><small>${esc(sub)}</small></span>${icon("chev")}</button>`;
    const f = release?.files?.[key];
    const detail = f ? [sub, release.version ? "v" + release.version : "", fmtSize(f.size)].filter(Boolean).join(" · ")
      : phase === "loading" ? "Checking the latest version…"
      : phase === "offline" ? "Couldn’t reach the download server"
      : "Not available yet";
    const inner = `<span class="dlx-file">${esc(tag)}</span><span class="dlx-ot"><b>${esc(name)}</b><small>${esc(detail)}</small></span>${f ? icon("chev") : ""}`;
    return f ? `<a class="dlx-opt" href="${esc(f.url)}" rel="noopener" download>${inner}</a>` : `<div class="dlx-opt off" role="note">${inner}</div>`;
  }).join("");
  const retry = phase === "offline" ? `<button type="button" class="dlx-retry" data-retry>Try again</button>` : "";
  const meta = phase === "ok" && release?.version ? `<p class="dlx-meta">Latest version ${esc(release.version)}${stale ? ". Showing the last version we saw, because GitHub could not be reached." : ""}</p>` : "";
  return `<div class="dlx-sheet" role="group" aria-label="${esc(g.title)}"><header><b>${esc(g.title)}</b><button type="button" class="dlx-x" aria-label="Close">${icon("x")}</button></header>${rows}${retry}${meta}</div>`;
}

function iosHow() {
  let host = CONFIG.APP_URL;
  try { host = new URL(CONFIG.APP_URL).host; } catch { /* keep the raw value */ }
  return `<header><b>Add to Home Screen</b><button type="button" class="dlx-x" aria-label="Close">${icon("x")}</button></header><p class="dlx-how">On your iPhone, open <b>${esc(host)}</b> in <b>Safari</b>, tap the <b>Share</b> button, then choose <b>Add to Home Screen</b>. You get the full app, no store needed.</p><a class="dlx-opt" href="${esc(CONFIG.APP_URL)}" target="_blank" rel="noopener"><span class="dlx-file">WEB</span><span class="dlx-ot"><b>Open the web app</b><small>${esc(host)}</small></span>${icon("chev")}</a>`;
}

function mountPicker(root) {
  const cards = $$(".dlx-card", root);
  if (!cards.length) return;
  const slot = $(".dlx-slot", root);
  let openId = "";

  const closeSheet = (restore = false) => {
    const was = openId;
    $$(".dlx-sheet", root).forEach((x) => x.remove());
    cards.forEach((c) => { c.classList.remove("open"); $(".dlx-head", c).setAttribute("aria-expanded", "false"); });
    openId = "";
    if (restore && was) $(`.dlx-card[data-g="${was}"] .dlx-head`, root)?.focus();
  };

  const wireSheet = (sh, g) => {
    $(".dlx-x", sh)?.addEventListener("click", () => closeSheet(true));
    $("[data-retry]", sh)?.addEventListener("click", () => load(true));
    $("[data-safari]", sh)?.addEventListener("click", () => { sh.innerHTML = iosHow(); $(".dlx-x", sh).addEventListener("click", () => closeSheet(true)); $(".dlx-opt", sh)?.focus(); });
  };

  const open = (id, { focus = true, scroll = true } = {}) => {
    const g = GROUPS.find((x) => x.id === id), card = $(`.dlx-card[data-g="${id}"]`, root);
    if (!g || !card) return;
    closeSheet();
    card.classList.add("open"); $(".dlx-head", card).setAttribute("aria-expanded", "true");
    const wrap = document.createElement("div"); wrap.innerHTML = sheetHtml(g);
    const sh = wrap.firstElementChild;
    if (mobile() || !slot) card.append(sh);
    else {
      slot.append(sh);
      const left = card.offsetLeft - $(".dlx-card", root).offsetLeft;
      sh.style.marginLeft = Math.max(0, Math.min(left, slot.clientWidth - 360)) + "px";
    }
    openId = id;
    wireSheet(sh, g);
    if (focus) (focusables(sh).find((el) => el.classList.contains("dlx-opt")) || $(".dlx-x", sh))?.focus({ preventScroll: true });
    if (scroll) sh.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  cards.forEach((card) => {
    const head = $(".dlx-head", card), id = card.dataset.g;
    head.addEventListener("click", () => (openId === id ? closeSheet() : open(id)));
  });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId) { e.stopPropagation(); closeSheet(true); } });

  // keep an open sheet up to date when the release answer arrives or is retried
  listeners.add(() => {
    if (!openId || !root.isConnected) return;
    const sh = $(".dlx-sheet", root); if (!sh) return;
    const g = GROUPS.find((x) => x.id === openId); if (!g) return;
    if (sh.querySelector(".dlx-how")) return; // keep the iOS how-to text as it is
    const wrap = document.createElement("div"); wrap.innerHTML = sheetHtml(g);
    const fresh = wrap.firstElementChild; const marginLeft = sh.style.marginLeft; sh.replaceWith(fresh); fresh.style.marginLeft = marginLeft; wireSheet(fresh, g);
  });

  // window resize between phone and desktop layouts: close, so the sheet never sits in the wrong place
  window.matchMedia("(max-width: 700px)").addEventListener?.("change", () => closeSheet());

  // highlight the visitor's device
  const hot = detectGroup(navigator.userAgent, navigator.maxTouchPoints || 0);
  if (hot) $(`.dlx-card[data-g="${hot}"]`, root)?.classList.add("hot");

  // "Download now" opens the picker for the detected device (or Android on desktop browsers that match nothing)
  const openDetected = () => {
    const target = hot || (mobile() ? "android" : "windows");
    const sec = root.closest("[data-download]") || root;
    const r = sec.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) sec.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => open(target, { scroll: false }), 250);
  };
  activeOpenDetected = () => { if (root.isConnected && root.closest("[data-download]")) openDetected(); };
  $$("[data-dl-now]", root.closest("[data-download]") || root).forEach((b) => b.addEventListener("click", openDetected));
}

export function initDownload() {
  const roots = $("[data-download]");
  if (!roots.length) { activeOpenDetected = null; return; }
  const freshRoots = roots.filter((root) => !mountedRoots.has(root));
  if (!freshRoots.length) return;
  freshRoots.forEach((root) => mountedRoots.add(root));
  // fetch lazily: when the section gets close to the screen, or right away if it is already near
  const start = () => { if (!loading) load(); };
  freshRoots.forEach((r) => mountPicker(r));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { start(); io.disconnect(); } }, { rootMargin: "400px 0px" });
    freshRoots.forEach((r) => io.observe(r));
  } else start();
  // #download in the address bar
  if (window.location.hash === "#download") start();
}
