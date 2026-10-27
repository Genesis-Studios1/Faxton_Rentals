// Reveal-on-scroll for the current page only. The observer/timer is replaced on each SPA navigation.
import { $$, prefersReducedMotion } from "./ui.js";

let activeObserver = null;
let safetyTimer = 0;
let safetyListenersReady = false;

function revealAll() {
  $$(".reveal").forEach((item) => item.classList.add("in"));
}
export function initReveal() {
  if (activeObserver) activeObserver.disconnect();
  activeObserver = null;
  window.clearTimeout(safetyTimer);

  if (!safetyListenersReady) {
    window.addEventListener("hashchange", revealAll);
    window.addEventListener("beforeprint", revealAll);
    safetyListenersReady = true;
  }

  const items = $$("#main .reveal");
  if (!items.length || prefersReducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("in"));
    return;
  }
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const below = items.filter((item) => item.getBoundingClientRect().top > vh * 0.92);
  items.filter((item) => !below.includes(item)).forEach((item) => item.classList.add("in"));
  if (!below.length) return;

  document.documentElement.classList.add("rv-on");
  activeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        activeObserver?.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  below.forEach((item) => activeObserver.observe(item));

  safetyTimer = window.setTimeout(() => {
    items.forEach((item) => { if (item.getBoundingClientRect().top < vh * 2) item.classList.add("in"); });
  }, 4000);
}
