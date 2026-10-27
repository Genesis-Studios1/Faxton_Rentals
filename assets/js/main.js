// Entry point for the public site. Core modules are re-initialised after SPA page swaps.
import { initHeader } from "./nav.js";
import { initReveal } from "./reveal.js";
import { initFooter } from "./footer.js";
import { initSpaRouter } from "./spa.js";

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
    if (has("[data-download]")) import("./download.js").then((m) => m.initDownload()).catch(() => {});
    if (has("[data-contact-form]") || has("[data-info]")) import("./contact.js").then((m) => m.initContact()).catch(() => {});
    if (has("[data-chat-demo]")) import("./feature-demo.js").then((m) => m.initFeatureDemo()).catch(() => {});
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
