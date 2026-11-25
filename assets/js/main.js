import { initHeader } from "./nav.js?v=2026-10-30.7";
import { initReveal } from "./reveal.js?v=2026-10-30.4";
import { initFooter } from "./footer.js?v=2026-10-30.5";
import { initSpaRouter } from "./spa.js?v=2026-10-30.5";
import { initDownload } from "./download.js?v=2026-11-03.1";

const has = (sel) => document.querySelector(sel);

// Keep waitlist entry points reliable on the homepage, including the fixed header and mobile menu.
function initWaitlistLinks() {
  if (document.documentElement.dataset.fxWaitlistLinksReady === "true") return;
  document.documentElement.dataset.fxWaitlistLinksReady = "true";
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const target = new URL(link.href, location.href);
    const section = document.querySelector("[data-waitlist]");
    if (target.origin !== location.origin || target.pathname !== location.pathname || target.hash !== "#waitlist" || !section) return;
    event.preventDefault();
    if (location.href !== target.href) history.pushState({ fxWaitlist: true }, "", target.href);
    const header = document.querySelector(".site-header");
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const targetTop = window.scrollY + section.getBoundingClientRect().top - headerHeight - 12;
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
    window.setTimeout(() => section.querySelector('[data-wl-role]')?.focus({ preventScroll: true }), 450);
  });
}
let pageBooting = false;

function safely(name, init) {
  try {
    init();
  } catch (error) {
    console.error("[Faxton] " + name + " could not initialise:", error);
  }
}

function bootPage() {
  if (pageBooting) return;
  pageBooting = true;
  try {
    // Downloads are a primary action: initialise them before optional page features.
    safely("downloads", initDownload);
    safely("header", initHeader);
    safely("footer", initFooter);
    safely("reveal animations", initReveal);
    if (has("[data-waitlist]")) import("./waitlist.js?v=2026-11-25.3").then((m) => m.initWaitlist()).catch((error) => console.error("[Faxton] waitlist could not initialise:", error));
    if (has("[data-contact-form]") || has("[data-info]")) import("./contact.js?v=2026-10-30.4").then((m) => m.initContact()).catch((error) => console.error("[Faxton] contact form could not initialise:", error));
    if (has("[data-chat-demo]")) import("./feature-demo.js?v=2026-10-30.4").then((m) => m.initFeatureDemo()).catch((error) => console.error("[Faxton] feature demo could not initialise:", error));
  } finally {
    pageBooting = false;
  }
}

function boot() {
  safely("waitlist navigation", initWaitlistLinks);
  safely("page navigation", initSpaRouter);
  bootPage();
}
document.addEventListener("fx:pagechange", bootPage);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
