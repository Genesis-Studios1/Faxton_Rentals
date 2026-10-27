// Entry point for the public site. Core modules are re-initialised after SPA page swaps.
import { initHeader } from "./nav.js?v=2026-10-27.4";
import { initReveal } from "./reveal.js?v=2026-10-27.4";
import { initFooter } from "./footer.js?v=2026-10-27.4";
import { initSpaRouter } from "./spa.js?v=2026-10-27.4";

const has = (sel) => document.querySelector(sel);
let pageBooting = false;

function bootPage() {
  if (pageBooting) return;
  pageBooting = true;
  try {
    initHeader();
    initFooter();
    initReveal();
    if (has("[data-waitlist]")) import("./waitlist.js").then((m) => m.initWaitlist()).catch(() => {});
    if (has("[data-download]")) import("./download.js?v=2026-10-27.4").then((m) => m.initDownload()).catch(() => {});
    if (has("[data-contact-form]") || has("[data-info]")) import("./contact.js").then((m) => m.initContact()).catch(() => {});
    if (has("[data-chat-demo]")) import("./feature-demo.js?v=2026-10-27.4").then((m) => m.initFeatureDemo()).catch(() => {});
  } finally {
    pageBooting = false;
  }
}

function boot() {
  initSpaRouter();
  bootPage();
}
document.addEventListener("fx:pagechange", bootPage);
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
