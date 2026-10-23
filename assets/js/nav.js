// Header behaviour: turns solid on scroll, and the mobile menu (focus trap, Esc closes, scroll lock).
import { $, $$, focusables } from "./ui.js";

export function initHeader() {
  const header = $(".site-header");
  if (!header) return;

  // solid after a little scroll. Pages with no dark hero start solid (data-solid).
  const always = header.hasAttribute("data-solid");
  let ticking = false;
  const apply = () => { ticking = false; header.classList.toggle("is-solid", always || window.scrollY > 24); };
  apply();
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });

  const btn = $(".menu-btn", header);
  const menu = $("#mobile-menu");
  if (!btn || !menu) return;
  const closeBtn = $(".m-menu__close", menu);
  let lastFocus = null;

  const isOpen = () => menu.classList.contains("is-open");
  const open = () => {
    lastFocus = document.activeElement;
    menu.hidden = false;
    // next frame so the transition runs
    requestAnimationFrame(() => menu.classList.add("is-open"));
    btn.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("nav-lock");
    // the rest of the page is not reachable while the menu is open
    $$("main, footer, .site-header, .skip-link").forEach((el) => el.setAttribute("inert", ""));
    menu.removeAttribute("inert");
    setTimeout(() => closeBtn?.focus(), 30);
  };
  const close = (restore = true) => {
    if (!isOpen()) return;
    menu.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("nav-lock");
    $$("main, footer, .site-header, .skip-link").forEach((el) => el.removeAttribute("inert"));
    setTimeout(() => { if (!isOpen()) menu.hidden = true; }, 280);
    if (restore) (lastFocus && document.contains(lastFocus) ? lastFocus : btn).focus();
  };

  btn.addEventListener("click", () => (isOpen() ? close() : open()));
  closeBtn?.addEventListener("click", () => close());
  // following a link inside the menu closes it (same-page links need this; other pages unload anyway)
  $$("a", menu).forEach((a) => a.addEventListener("click", () => close(false)));

  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const items = focusables(menu);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) close(); });

  // the menu is only for small screens: close it if the window grows
  window.matchMedia("(min-width: 1020px)").addEventListener?.("change", (m) => { if (m.matches) close(false); });
}
