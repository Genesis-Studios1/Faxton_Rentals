#!/usr/bin/env node
// Point the site at its real address: canonical links, share-card (Open Graph / Twitter) images,
// JSON-LD, sitemap.xml and robots.txt. Until you do, the pages use relative addresses and a placeholder sitemap.
//
//   node tools/set-site-url.mjs https://faxtonrentals.com            (edits the files in place)
//   node tools/set-site-url.mjs https://you.github.io/Faxton_Rentals _site   (edits a copy, as the Pages workflow does)
//
// Safe to run again with a different address.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const [, , input, dirArg = "."] = process.argv;
if (!input || !/^https?:\/\/[^/\s]+/i.test(input)) {
  console.error("Usage: node tools/set-site-url.mjs <https://your-address> [folder]");
  process.exit(1);
}
const site = new URL(input);
const origin = site.origin;
const basePath = site.pathname.replace(/\/+$/, "");          // "" or "/repo"
const base = origin + basePath;                               // no trailing slash
const root = dirArg;

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  if (["node_modules", ".git", ".github", "tests", "tools", "_refs"].includes(n)) return [];
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// "features/index.html" -> "/features/", "index.html" -> "/"
const pageUrl = (file) => {
  const rel = relative(root, file).split(sep).join("/");
  const dir = rel.replace(/index\.html$/, "");
  return `${base}/${dir}`;
};
const abs = (ref, from) => new URL(ref, from).href;

let changed = 0;
for (const file of walk(root).filter((f) => f.endsWith(".html"))) {
  let html = readFileSync(file, "utf8");
  const before = html;
  const here = pageUrl(file);
  const is404 = /(^|[\\/])404\.html$/.test(file);

  // The 404 page is served from any depth, so it needs the site's base path.
  html = html.replace(/<base href="[^"]*">/, `<base href="${basePath}/">`);

  if (!is404) {
    html = html.replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${here}$2`);
    // og:url is added once, right after og:type
    html = html.replace(/<meta property="og:url" content="[^"]*">\n?/, "");
    html = html.replace(/(<meta property="og:type" content="website">\n)/, `$1<meta property="og:url" content="${here}">\n`);
  }
  // images: resolve whatever relative path the page uses against the page's own address
  html = html.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")([^"]*)(">)/g, (_, a, ref, c) => `${a}${abs(ref, here)}${c}`);

  // JSON-LD: make ids, urls and logos absolute
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (_, open, json, close) => {
    try {
      const fix = (v) => {
        if (typeof v === "string") return /^(\.\/|assets\/)/.test(v) ? abs(v, `${base}/`) : v;
        if (Array.isArray(v)) return v.map(fix);
        if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)]));
        return v;
      };
      return open + JSON.stringify(fix(JSON.parse(json))) + close;
    } catch { return _; }
  });

  if (html !== before) { writeFileSync(file, html); changed++; console.log("updated", relative(root, file)); }
}

const sm = join(root, "sitemap.xml");
if (existsSync(sm)) {
  // each <loc> becomes <your address> + the page it stands for (works again after a previous run)
  const x = readFileSync(sm, "utf8").replace(/<loc>([^<]*)<\/loc>/g, (_, oldUrl) => {
    let pathname = "/";
    try { pathname = new URL(oldUrl, `${base}/`).pathname; } catch {}
    const page = pathname.match(/\/(features|contact|about|billing)\/?$/)?.[1];
    return `<loc>${base}/${page ? page + "/" : ""}</loc>`;
  });
  writeFileSync(sm, x); console.log("updated sitemap.xml");
}
const rb = join(root, "robots.txt");
if (existsSync(rb)) {
  let t = readFileSync(rb, "utf8").replace(/^#? ?Sitemap:.*\n?/gm, "").replace(/\s*$/, "\n");
  t += `Sitemap: ${base}/sitemap.xml\n`;
  writeFileSync(rb, t); console.log("updated robots.txt");
}
console.log(`Done. Site address: ${base}/  (${changed} page(s) changed)`);
