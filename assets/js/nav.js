// Header behaviour: stable scroll state and accessible mobile menu.
// Existing listeners are cleaned up when the SPA swaps the shared header.
import { $, $$, focusables } from "./ui.js";

let cleanupCurrent = () => {};

export function initHeader() {
  cleanupCurrent();
  const removers = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  cleanupCurrent = () => { removers.splice(0).forEach((remove) => remove()); };

  const header = $(".site-header");
  if (!header) return;
  const always = header.hasAttribute("data-solid");
  const readScrollPosition = () => Math.max(
    window.scrollY || 0,
    window.pageYOffset || 0,
    document.scrollingElement?.scrollTop || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0
  );
  // Keep the class update synchronous with the scroll event so the visual state cannot lag.
  const syncScrollState = () => {
    header.classList.toggle("is-solid", always || readScrollPosition() > 8);
  };
  syncScrollState();
  listen(window, "scroll", syncScrollState, { passive: true });
  listen(document, "scroll", syncScrollState, { passive: true, capture: true });
  listen(window, "pageshow", syncScrollState);
  listen(window, "resize", syncScrollState, { passive: true });
  listen(document, "visibilitychange", () => { if (!document.hidden) syncScrollState(); });

  const btn = $(".menu-btn", header);
  const menu = $("#mobile-menu");
  if (!btn || !menu) return;
  const closeBtn = $(".m-menu__close", menu);
  let lastFocus = null;
  let closeTimer = 0;

  const isOpen = () => menu.classList.contains("is-open");
  const open = () => {
    lastFocus = document.activeElement;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("is-open"));
    btn.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("nav-lock");
    $$("main, footer, .site-header, .skip-link").forEach((el) => el.setAttribute("inert", ""));
    menu.removeAttribute("inert");
    window.setTimeout(() => closeBtn?.focus(), 30);
  };
  const close = (restore = true) => {
    if (!isOpen()) return;
    menu.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("nav-lock");
    $$("main, footer, .site-header, .skip-link").forEach((el) => el.removeAttribute("inert"));
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => { if (!isOpen()) menu.hidden = true; }, 280);
    if (restore) (lastFocus && document.contains(lastFocus) ? lastFocus : btn).focus();
  };

  listen(btn, "click", () => (isOpen() ? close() : open()));
  if (closeBtn) listen(closeBtn, "click", () => close());
  $$("a", menu).forEach((anchor) => listen(anchor, "click", () => close(false)));
  listen(menu, "keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const items = focusables(menu);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  const onDocumentKeydown = (event) => { if (event.key === "Escape" && isOpen()) close(); };
  listen(document, "keydown", onDocumentKeydown);
  const media = window.matchMedia("(min-width: 1020px)");
  const onMediaChange = (event) => { if (event.matches) close(false); };
  media.addEventListener?.("change", onMediaChange);
  if (media.addEventListener) removers.push(() => media.removeEventListener("change", onMediaChange));
  cleanupCurrent = () => {
    window.clearTimeout(closeTimer);
    removers.splice(0).forEach((remove) => remove());
  };
}
