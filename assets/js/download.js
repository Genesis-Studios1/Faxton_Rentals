// Shared device-download dialog for every page and every download entry point.
import { CONFIG } from "./config.js";
import { GROUPS, detectGroup, fmtSize, loadLatest } from "./download-core.js?v=2026-10-30.3";
import { $, esc, icon, store } from "./ui.js";

let dialog = null;
let details = null;
let activeGroup = "";
let latest = { phase: "loading", release: null, stale: false };
let request = null;
let fetched = false;
let initialized = false;

const DEVICES = [
  ["website", "Website", "Open the web app", "WEB"],
  ["android", "Android", "Phones and tablets", "AND"],
  ["ios", "iOS", "iPhone and iPad", "iOS"],
  ["windows", "Windows", "PC and laptop", "WIN"],
  ["mac", "macOS", "MacBook and iMac", "MAC"],
  ["linux", "Linux", "Linux computers", "LIN"],
];

function sheetHtml(group) {
  const rows = group.opts.map(([key, tag, name, sub]) => {
    if (key === "#safari") {
      return '<button type="button" class="dlx-opt" data-safari><span class="dlx-file">' + tag +
        '</span><span class="dlx-ot"><b>' + esc(name) + '</b><small>' + esc(sub) +
        '</small></span>' + icon("chev") + '</button>';
    }
    const file = latest.release?.files?.[key];
    const description = file
      ? [sub, latest.release.version ? "v" + latest.release.version : "", fmtSize(file.size)].filter(Boolean).join(" · ")
      : latest.phase === "loading" ? "Checking the latest version…"
      : latest.phase === "offline" ? "Couldn’t reach the download server"
      : "Not available yet";
    const inner = '<span class="dlx-file">' + esc(tag) + '</span><span class="dlx-ot"><b>' +
      esc(name) + '</b><small>' + esc(description) + '</small></span>' + (file ? icon("chev") : "");
    return file
      ? '<a class="dlx-opt" href="' + esc(file.url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>'
      : '<div class="dlx-opt off" role="note">' + inner + '</div>';
  }).join("");
  const retry = latest.phase === "offline"
    ? '<button type="button" class="dlx-retry" data-retry>Try again</button>' : "";
  const meta = latest.phase === "ok" && latest.release?.version
    ? '<p class="dlx-meta">Latest version ' + esc(latest.release.version) +
      (latest.stale ? '. Showing the last version we saw because GitHub could not be reached.' : "") + '</p>' : "";
  return '<div class="dlx-sheet" role="group" aria-label="' + esc(group.title) + '">' +
    '<header><b>' + esc(group.title) + '</b><button type="button" class="dlx-x" data-close-sheet aria-label="Close">' +
    icon("x") + '</button></header>' + rows + retry + meta + '</div>';
}

function iosHow() {
  let host = CONFIG.APP_URL;
  try { host = new URL(CONFIG.APP_URL).host; } catch { /* keep the configured value */ }
  return '<div class="dlx-sheet" role="group" aria-label="Add to Home Screen">' +
    '<header><b>Add to Home Screen</b><button type="button" class="dlx-x" data-close-sheet aria-label="Back">' +
    icon("x") + '</button></header>' +
    '<p class="dlx-how">On your iPhone, open <b>' + esc(host) +
    '</b> in <b>Safari</b>, tap the <b>Share</b> button, then choose <b>Add to Home Screen</b>. You can then open Faxton Rentals like an app.</p>' +
    '<a class="dlx-opt" href="' + esc(CONFIG.APP_URL) + '" target="_blank" rel="noopener noreferrer">' +
    '<span class="dlx-file">WEB</span><span class="dlx-ot"><b>Open the web app</b><small>' +
    esc(host) + '</small></span>' + icon("chev") + '</a></div>';
}

function renderDetails() {
  if (!details) return;
  const group = GROUPS.find((item) => item.id === activeGroup);
  if (!group) {
    details.innerHTML = '<div class="dl-modal__empty"><span aria-hidden="true">↓</span><b>Choose your device</b><p>Select a platform above to see the available Faxton Rentals downloads.</p></div>';
    return;
  }
  details.innerHTML = sheetHtml(group);
}

function loadLatestRelease(force = false) {
  if (request && !force) return request;
  if (fetched && !force) return Promise.resolve(latest);
  latest = { ...latest, phase: "loading" };
  renderDetails();
  request = loadLatest({ repo: CONFIG.RELEASES_REPO, storage: store, force })
    .then((result) => {
      latest = { phase: result.state, release: result.release, stale: result.stale };
      fetched = true;
      renderDetails();
      return latest;
    })
    .catch(() => {
      latest = { phase: "offline", release: null, stale: false };
      fetched = true;
      renderDetails();
      return latest;
    })
    .finally(() => { request = null; });
  return request;
}

function openDialog(groupId = "") {
  if (!dialog) return;
  activeGroup = GROUPS.some((item) => item.id === groupId) ? groupId : "";
  renderDetails();
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  loadLatestRelease();
}

function createDialog() {
  dialog = document.createElement("dialog");
  dialog.id = "download-dialog";
  dialog.className = "dl-modal";
  dialog.setAttribute("aria-labelledby", "dl-modal-title");
  dialog.innerHTML =
    '<div class="dl-modal__in">' +
      '<div class="dl-modal__top"><div><p class="eyebrow">GET FAXTON RENTALS</p>' +
        '<h2 id="dl-modal-title">Choose your device</h2>' +
        '<p>Pick a platform to see the latest available app package.</p></div>' +
        '<button type="button" class="dl-modal__close" data-modal-close aria-label="Close downloads">' + icon("x") + '</button>' +
      '</div>' +
      '<div class="dl-modal__cards" role="group" aria-label="Available platforms">' +
        DEVICES.map(([id, name, description, label]) => id === "website"
          ? '<a class="dl-modal-card" href="' + esc(CONFIG.APP_URL) + '" target="_blank" rel="noopener noreferrer"><span class="dl-modal-card__icon">' + label + '</span><span class="dl-modal-card__text"><b>' + name + '</b><small>' + description + '</small></span>' + icon("chev") + '</a>'
          : '<button type="button" class="dl-modal-card" data-modal-platform="' + id + '" aria-pressed="false"><span class="dl-modal-card__icon">' + label + '</span><span class="dl-modal-card__text"><b>' + name + '</b><small>' + description + '</small></span>' + icon("chev") + '</button>'
        ).join("") +
      '</div>' +
      '<div class="dl-modal__details" aria-live="polite"><div class="dl-modal__empty"><b>Choose your device</b><p>Select a platform above to see the available downloads.</p></div></div>' +
      '<p class="dl-modal__foot">Only packages published in the official Faxton Rentals release are shown.</p>' +
    '</div>';
  document.body.append(dialog);
  details = $(".dl-modal__details", dialog);

  const hot = detectGroup(navigator.userAgent, navigator.maxTouchPoints || 0);
  if (hot) {
    const card = $('.dl-modal-card[data-modal-platform="' + hot + '"]', dialog);
    card?.classList.add("hot");
    card?.setAttribute("aria-label", hot + " — recommended for your device");
  }

  dialog.addEventListener("click", (event) => {
    const target = event.target;
    if (target === dialog) { dialog.close(); return; }
    if (!(target instanceof Element)) return;
    if (target.closest("[data-modal-close]")) { dialog.close(); return; }

    const platform = target.closest("[data-modal-platform]");
    if (platform) {
      activeGroup = platform.dataset.modalPlatform || "";
      dialog.querySelectorAll("[data-modal-platform]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button === platform));
      });
      renderDetails();
      loadLatestRelease();
      return;
    }
    if (target.closest("[data-retry]")) { loadLatestRelease(true); return; }
    if (target.closest("[data-safari]")) { details.innerHTML = iosHow(); return; }
    if (target.closest("[data-close-sheet]")) { renderDetails(); }
  });
  dialog.addEventListener("cancel", () => { activeGroup = ""; });
  dialog.addEventListener("close", () => { activeGroup = ""; });
}

export function initDownload() {
  if (initialized) return;
  initialized = true;
  createDialog();

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const downloadButton = event.target.closest("[data-dl-now]");
    if (downloadButton) {
      event.preventDefault();
      openDialog();
      return;
    }
    const platformButton = event.target.closest("[data-open-download][data-group]");
    if (platformButton) {
      event.preventDefault();
      openDialog(platformButton.dataset.group || "");
    }
  });
  document.addEventListener("fx:open-download", () => openDialog());
  document.addEventListener("fx:pagewillchange", () => {
    if (dialog?.open) dialog.close();
    activeGroup = "";
  });
}
