// Header behaviour: reliable scroll state and accessible mobile menu.
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
  const readScrollPosition = () => {
    const root = document.scrollingElement || document.documentElement;
    return Math.max(
      window.scrollY || 0,
      window.pageYOffset || 0,
      root.scrollTop || 0,
      document.documentElement.scrollTop || 0,
      document.body?.scrollTop || 0
    );
  };
  const syncScrollState = () => {
    header.classList.toggle("is-solid", always || readScrollPosition() > 12);
  };

  // Apply immediately, then keep the fixed header in sync with whichever element scrolls.
  syncScrollState();
  listen(window, "scroll", syncScrollState, { passive: true });
  listen(document, "scroll", syncScrollState, { passive: true, capture: true });
  listen(window, "pageshow", syncScrollState);
  listen(window, "resize", syncScrollState, { passive: true });
  listen(window, "hashchange", syncScrollState);
  if (window.visualViewport) listen(window.visualViewport, "scroll", syncScrollState, { passive: true });
  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(syncScrollState);

  const btn = $(".menu-btn", header);
  const menu = $("#mobile-menu");
  if (!btn || !menu) return;
  const closeBtn = $(".m-menu__close", menu);
  let lastFocus = null;
  let closeTimer = 0;

  const isOpen = () => menu.classList.contains("is-open");
  const open = () => {
    lastFocus = document.activeElement;
    window.clearTimeout(closeTimer);
    menu.hidden = false;
    menu.removeAttribute("inert");
    window.requestAnimationFrame(() => menu.classList.add("is-open"));
    btn.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("nav-lock");
    $$("main, footer, .site-header, .skip-link").forEach((el) => el.setAttribute("inert", ""));
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
  listen(document, "keydown", (event) => { if (event.key === "Escape" && isOpen()) close(); });
  const media = window.matchMedia("(min-width: 1020px)");
  const onMediaChange = (event) => { if (event.matches) close(false); };
  if (media.addEventListener) {
    media.addEventListener("change", onMediaChange);
    removers.push(() => media.removeEventListener("change", onMediaChange));
  } else if (media.addListener) {
    media.addListener(onMediaChange);
    removers.push(() => media.removeListener(onMediaChange));
  }

  const previousCleanup = cleanupCurrent;
  cleanupCurrent = () => {
    window.clearTimeout(closeTimer);
    previousCleanup();
  };
}
