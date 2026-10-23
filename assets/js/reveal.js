// Reveal-on-scroll with IntersectionObserver. Elements already on screen are never hidden (no flash),
// and if anything goes wrong the content simply stays visible.
import { $$, prefersReducedMotion } from "./ui.js";

export function initReveal() {
  const items = $$(".reveal");
  if (!items.length || prefersReducedMotion() || !("IntersectionObserver" in window)) return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const below = items.filter((el) => el.getBoundingClientRect().top > vh * 0.92);
  if (!below.length) return;
  document.documentElement.classList.add("rv-on");
  // everything that starts on screen is shown straight away
  items.filter((el) => !below.includes(el)).forEach((el) => el.classList.add("in"));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  below.forEach((el) => io.observe(el));
  // safety net: never leave anything hidden for long (printing, odd browsers, anchors that jump)
  window.addEventListener("hashchange", () => items.forEach((el) => el.classList.add("in")));
  window.addEventListener("beforeprint", () => items.forEach((el) => el.classList.add("in")));
  setTimeout(() => items.forEach((el) => { if (el.getBoundingClientRect().top < vh * 2) el.classList.add("in"); }), 4000);
}
