#!/usr/bin/env node
// Static link checker (no packages): every local link, image, script, stylesheet, srcset entry, sprite
// reference and CSS url() in the site must exist, and every #anchor must exist on its target page.
// External (https) addresses are listed but not fetched. Run:  node tools/check-links.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";

const root = resolve(process.argv[2] || ".");
const SKIP = new Set(["node_modules", ".git", ".github", "tests", "tools", "_refs", "_site"]);
const walk = (d) => readdirSync(d).flatMap((n) => (SKIP.has(n) ? [] : (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])));
const files = walk(root);
const pages = files.filter((f) => f.endsWith(".html"));
const css = files.filter((f) => f.endsWith(".css"));
const problems = [], externals = new Set();
let checked = 0;

const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) {
    const h = readFileSync(file, "utf8");
    idsCache.set(file, new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
};

function resolveTarget(fromFile, ref, baseHref) {
  // returns { file, hash } or null for things that are not local files
  if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(ref) && !ref.startsWith("#")) return null;
  const [pathPart, ...h] = ref.split("#"); const hash = h.join("#");
  const noQuery = pathPart.split("?")[0];
  let target;
  if (!noQuery) target = fromFile;
  else if (noQuery.startsWith("/")) target = join(root, noQuery);
  else target = resolve(baseHref ? join(root, baseHref) : dirname(fromFile), noQuery);
  if (!noQuery) return { file: fromFile, hash };
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
  return { file: target, hash };
}

function check(fromFile, ref, kind, baseHref) {
  ref = ref.trim();
  if (!ref) return;
  if (/^https?:\/\//i.test(ref)) { externals.add(ref.split("#")[0]); return; }
  if (/^(mailto:|tel:|data:|javascript:)/i.test(ref)) return;
  const t = resolveTarget(fromFile, ref, baseHref);
  if (!t) return;
  checked++;
  const where = relative(root, fromFile);
  if (!existsSync(t.file)) { problems.push(`${where}: ${kind} -> ${ref}  (missing file ${relative(root, t.file)})`); return; }
  if (t.hash && t.file.endsWith(".html") && !idsOf(t.file).has(t.hash)) problems.push(`${where}: ${kind} -> ${ref}  (no #${t.hash} on ${relative(root, t.file)})`);
}

for (const f of pages) {
  const html = readFileSync(f, "utf8");
  const baseHref = (html.match(/<base href="([^"]*)">/) || [])[1];
  const b = baseHref && baseHref !== "/" ? baseHref : baseHref === "/" ? "" : undefined;
  const get = (re, kind) => { for (const m of html.matchAll(re)) check(f, m[1].replace(/&amp;/g, "&"), kind, b); };
  get(/<a\s[^>]*?href="([^"]*)"/g, "link");
  get(/<link\s[^>]*?href="([^"]*)"/g, "link tag");
  get(/<(?:img|source|script|video|audio|use)\s[^>]*?(?:src|href)="([^"]*)"/g, "asset");
  for (const m of html.matchAll(/(?:srcset|imagesrcset)="([^"]*)"/g)) for (const part of m[1].split(",")) check(f, part.trim().split(/\s+/)[0], "srcset", b);
  for (const m of html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]*)"/g)) check(f, m[1], "share image", b);
  // basic hygiene: images need width/height and alt
  for (const m of html.matchAll(/<img\s[^>]*>/g)) {
    const tag = m[0];
    if (!/\salt="/.test(tag)) problems.push(`${relative(root, f)}: <img> without alt: ${tag.slice(0, 80)}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) problems.push(`${relative(root, f)}: <img> without width/height: ${tag.slice(0, 90)}`);
  }
  if (/\sstyle="/.test(html)) problems.push(`${relative(root, f)}: inline style="" attribute (the Content-Security-Policy blocks it)`);
  if (/<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>/.test(html)) problems.push(`${relative(root, f)}: inline <script> (the Content-Security-Policy blocks it)`);
  if (/\son[a-z]+="/.test(html)) problems.push(`${relative(root, f)}: inline event handler attribute`);
}
for (const f of css) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
    const ref = m[2];
    if (ref.startsWith("data:") || ref.startsWith("#")) continue;
    check(f, ref, "css url()");
  }
}
for (const f of [join(root, "manifest.webmanifest")].filter(existsSync)) {
  const j = JSON.parse(readFileSync(f, "utf8"));
  for (const ic of j.icons || []) check(f, ic.src, "manifest icon");
}

console.log(`Checked ${checked} local references in ${pages.length} pages and ${css.length} stylesheets.`);
console.log(`External addresses (not fetched): ${externals.size}`);
[...externals].sort().forEach((u) => console.log("  " + u));
if (problems.length) { console.error(`\n${problems.length} problem(s):`); problems.forEach((p) => console.error(" - " + p)); process.exit(1); }
console.log("No broken local links, images or anchors.");
