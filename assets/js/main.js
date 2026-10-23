// Entry point loaded on every page. Page-specific parts are loaded only when the page has them.
import { initHeader } from "./nav.js";
import { initReveal } from "./reveal.js";
import { initFooter } from "./footer.js";

const has = (sel) => document.querySelector(sel);

function boot() {
  initHeader();
  initFooter();
  initReveal();
  if (has("[data-waitlist]")) import("./waitlist.js").then((m) => m.initWaitlist()).catch(() => {});
  if (has("[data-download]")) import("./download.js").then((m) => m.initDownload()).catch(() => {});
  if (has("[data-contact-form]") || has("[data-info]")) import("./contact.js").then((m) => m.initContact()).catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
