// Lightweight same-origin navigation for the public marketing site.
// Keeps the shell intact, prefetches navigation targets, and preserves ordinary navigation as fallback.
const pageCache = new Map();
const inFlightPages = new Map();
const preloadedImages = new Set();
const MAX_CACHE = 7;
let activeController = null;
let progressTimer = 0;
let progressEl = null;

const pageKey = (url) => url.pathname + url.search;
const isLocalPage = (url) => url.origin === location.origin &&
  !/\.(?:pdf|zip|exe|dmg|apk|msi|png|jpe?g|webp|svg|ico|woff2?|ttf|mp4|mp3)$/i.test(url.pathname);

function getProgress() {
  if (progressEl) return progressEl;
  progressEl = document.createElement("div");
  progressEl.id = "fx-spa-progress";
  progressEl.setAttribute("aria-hidden", "true");
  document.body.append(progressEl);
  return progressEl;
}
function startProgress() {
  const el = getProgress();
  clearTimeout(progressTimer);
  el.classList.remove("is-active");
  void el.offsetWidth;
  progressTimer = window.setTimeout(() => el.classList.add("is-active"), 90);
}
function stopProgress() {
  clearTimeout(progressTimer);
  if (progressEl) progressEl.classList.remove("is-active");
}

async function loadHTML(url) {
  const key = pageKey(url);
  if (pageCache.has(key)) return pageCache.get(key);
  if (inFlightPages.has(key)) return inFlightPages.get(key);
  const request = (async () => {
    const response = await fetch(key, {
      method: "GET",
      credentials: "same-origin",
      headers: { "X-Faxton-Navigation": "1" }
    });
    if (!response.ok) throw new Error("Page request failed (" + response.status + ")");
    const type = response.headers.get("content-type") || "";
    if (type && type.indexOf("text/html") === -1) throw new Error("Target is not an HTML page");
    const html = await response.text();
    pageCache.set(key, html);
    while (pageCache.size > MAX_CACHE) pageCache.delete(pageCache.keys().next().value);
    return html;
  })();
  inFlightPages.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlightPages.get(key) === request) inFlightPages.delete(key);
  }
}
async function prefetch(url) {
  if (!isLocalPage(url) || url.pathname === location.pathname || pageCache.has(pageKey(url))) return;
  try {
    const html = await loadHTML(new URL(url.pathname + url.search, location.origin));
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const image = parsed.querySelector("main#main .hero__bg img");
    const source = parsed.querySelector("main#main .hero__bg source[media]");
    let src = image ? image.getAttribute("src") : "";
    if (source && image && matchMedia(source.media).matches && source.getAttribute("srcset")) {
      src = source.getAttribute("srcset").split(",")[0].trim().split(/\s+/)[0];
    }
    if (src) {
      const imageUrl = new URL(src, url).href;
      if (!preloadedImages.has(imageUrl)) {
        preloadedImages.add(imageUrl);
        const preload = new Image();
        preload.decoding = "async";
        preload.src = imageUrl;
      }
    }
  } catch { /* A failed prefetch never blocks the actual navigation. */ }
}
// Rebase links and resources against the destination page before inserting its DOM.
// This prevents relative SVG sprites and images resolving under the page we left.
function resolveResource(value, baseUrl) {
  const raw = String(value || '').trim();
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return raw;
  try { return new URL(raw, baseUrl).href; } catch { return raw; }
}
function resolveSrcset(value, baseUrl) {
  return String(value || '').split(',').map((candidate) => {
    const part = candidate.trim();
    if (!part) return part;
    const firstSpace = part.search(/\s/);
    const resource = firstSpace < 0 ? part : part.slice(0, firstSpace);
    const descriptor = firstSpace < 0 ? '' : part.slice(firstSpace);
    return resolveResource(resource, baseUrl) + descriptor;
  }).join(', ');
}
function rebaseIncomingUrls(root, targetUrl) {
  const nodes = [root, ...root.querySelectorAll('*')];
  for (const node of nodes) {
    for (const attr of ['href', 'xlink:href', 'src', 'poster', 'action', 'formaction', 'data']) {
      if (!node.hasAttribute(attr)) continue;
      node.setAttribute(attr, resolveResource(node.getAttribute(attr), targetUrl));
    }
    if (node.hasAttribute('srcset')) node.setAttribute('srcset', resolveSrcset(node.getAttribute('srcset'), targetUrl));
  }
}

function copyMetadata(parsed, url) {
  if (parsed.title) document.title = parsed.title;
  if (parsed.documentElement.lang) document.documentElement.lang = parsed.documentElement.lang;
  const sync = (selector) => {
    const source = parsed.head.querySelector(selector);
    if (!source) return;
    let target = document.head.querySelector(selector);
    if (!target) {
      target = document.createElement(source.tagName.toLowerCase());
      document.head.append(target);
    }
    for (const name of Array.from(target.getAttributeNames())) {
      if (!source.hasAttribute(name)) target.removeAttribute(name);
    }
    for (const name of Array.from(source.getAttributeNames())) target.setAttribute(name, source.getAttribute(name));
    if (source.tagName.toLowerCase() === "meta" && source.hasAttribute("content")) target.content = source.content;
  };
  ["description", "theme-color"].forEach((name) => sync('meta[name="' + name + '"]'));
  ["og:title", "og:description", "og:url"].forEach((name) => sync('meta[property="' + name + '"]'));
  ["twitter:title", "twitter:description"].forEach((name) => sync('meta[name="' + name + '"]'));
  const canonicalSource = parsed.head.querySelector('link[rel="canonical"]');
  if (canonicalSource) {
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
    canonical.href = new URL(canonicalSource.getAttribute("href"), url).href;
  }
}
function scrollToDestination(url, smooth) {
  requestAnimationFrame(() => {
    if (url.hash) {
      let id = "";
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { id = url.hash.slice(1); }
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}
async function navigate(input, options) {
  const push = !options || options.push !== false;
  const smooth = !options || options.smooth !== false;
  const url = new URL(input, location.href);
  if (!isLocalPage(url)) { location.assign(url.href); return; }
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;
  startProgress();
  try {
    const html = await loadHTML(url);
    if (controller.signal.aborted) return;
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const incoming = {
      header: parsed.querySelector(".site-header"),
      menu: parsed.querySelector("#mobile-menu"),
      main: parsed.querySelector("main#main"),
      footer: parsed.querySelector(".site-foot")
    };
    const current = {
      header: document.querySelector(".site-header"),
      menu: document.querySelector("#mobile-menu"),
      main: document.querySelector("main#main"),
      footer: document.querySelector(".site-foot")
    };
    if (Object.values(incoming).some((el) => !el) || Object.values(current).some((el) => !el)) throw new Error("Page shell is incomplete");

    Object.values(incoming).forEach((root) => rebaseIncomingUrls(root, url));
    document.dispatchEvent(new CustomEvent("fx:pagewillchange", { detail: { url: url.href } }));
    document.documentElement.classList.remove("nav-lock");
    ["header", "menu", "main", "footer"].forEach((name) => current[name].replaceWith(document.importNode(incoming[name], true)));
    document.body.dataset.root = parsed.body.dataset.root || "";
    document.body.dataset.page = parsed.body.dataset.page || "";
    copyMetadata(parsed, url);
    if (push) history.pushState({ fxSpa: true }, "", url.href);
    else if (location.href !== url.href) history.replaceState({ fxSpa: true }, "", url.href);

    const main = document.querySelector("main#main");
    if (main) main.classList.add("spa-entering");
    window.setTimeout(() => { if (main) main.classList.remove("spa-entering"); }, 220);
    document.dispatchEvent(new CustomEvent("fx:pagechange", { detail: { url: url.href, page: document.body.dataset.page } }));
    scrollToDestination(url, smooth);
  } catch (error) {
    if (!controller.signal.aborted && error.name !== "AbortError") location.assign(url.href);
  } finally {
    if (activeController === controller) {
      activeController = null;
      stopProgress();
    }
  }
}

export function initSpaRouter() {
  if (document.documentElement.dataset.fxSpaReady === "true") return;
  document.documentElement.dataset.fxSpaReady = "true";
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor || anchor.hasAttribute("download") || anchor.hasAttribute("data-no-spa") ||
        (anchor.target && anchor.target !== "_self") || anchor.relList.contains("external")) return;
    const url = new URL(anchor.href, location.href);
    if (!isLocalPage(url)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    navigate(url, { push: true, smooth: true });
  });
  document.addEventListener("pointerover", (event) => {
    const anchor = event.target.closest && event.target.closest(".nav-pill a, #mobile-menu a, .site-foot a");
    if (anchor) prefetch(new URL(anchor.href, location.href));
  }, { passive: true });
  document.addEventListener("focusin", (event) => {
    const anchor = event.target.closest && event.target.closest(".nav-pill a, #mobile-menu a, .site-foot a");
    if (anchor) prefetch(new URL(anchor.href, location.href));
  });
  window.addEventListener("popstate", () => navigate(location.href, { push: false, smooth: false }));
}
