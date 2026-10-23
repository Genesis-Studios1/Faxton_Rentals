// Small shared helpers: DOM shortcuts, icons (from the SVG sprite), toast, safe storage.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The sprite lives next to the scripts' folder, so the same code works from any page depth.
const SPRITE = new URL("../img/sprite.svg", import.meta.url).href;
export const icon = (name, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="${SPRITE}#${name}"/></svg>`;

// Storage can throw (private windows, blocked site data). Every use goes through these.
export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { window.localStorage.removeItem(k); } catch { /* ignore */ } },
};

let toastEl = null, toastTimer = 0;
export function toast(message, ms = 3600) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "fx-toast";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  // restart the transition so a second toast is announced again
  toastEl.classList.remove("is-on");
  void toastEl.offsetWidth;
  toastEl.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl && toastEl.classList.remove("is-on"), ms);
}

export const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// The address people should share: the configured SITE_URL, or the current page without hash or query.
export function shareUrl(siteUrl) {
  if (siteUrl) return siteUrl.replace(/\/+$/, "") + "/";
  const u = new URL(window.location.href);
  u.hash = ""; u.search = "";
  return u.href.replace(/index\.html$/, "");
}

export function focusables(root) {
  return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter((el) => !el.hasAttribute("hidden") && el.offsetParent !== null);
}
