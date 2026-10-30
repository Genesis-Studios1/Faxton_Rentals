import { initHeader } from "./nav.js?v=2026-10-30.5";
import { initReveal } from "./reveal.js?v=2026-10-30.4";
import { initFooter } from "./footer.js?v=2026-10-30.4";
import { initSpaRouter } from "./spa.js?v=2026-10-30.4";
import { initDownload } from "./download.js?v=2026-10-30.8";

const has = (sel) => document.querySelector(sel);
let pageBooting = false;

function bootPage() {
  if (pageBooting) return;
  pageBooting = true;
  try {
    initHeader();
    initFooter();
    initReveal();
    if (has("[data-waitlist]")) import("./waitlist.js?v=2026-10-30.4").then((m) => m.initWaitlist()).catch(() => {});
    initDownload();
    if (has("[data-contact-form]") || has("[data-info]")) import("./contact.js?v=2026-10-30.4").then((m) => m.initContact()).catch(() => {});
    if (has("[data-chat-demo]")) import("./feature-demo.js?v=2026-10-30.4").then((m) => m.initFeatureDemo()).catch(() => {});
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
