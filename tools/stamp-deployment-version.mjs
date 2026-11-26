#!/usr/bin/env node
// Stamp every published page with the commit that built it and publish a no-cache version endpoint.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [, , version, root = "."] = process.argv;
if (!version || !/^[a-f0-9]{7,40}$/i.test(version)) {
  console.error("Usage: node tools/stamp-deployment-version.mjs <git-sha> [site-folder]");
  process.exit(1);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

let stamped = 0;
for (const file of walk(root).filter((path) => path.endsWith(".html"))) {
  const original = readFileSync(file, "utf8");
  const next = original
    .replace(/<html\b([^>]*)>/i, (tag, attrs) => {
      const clean = attrs.replace(/\sdata-fx-build=(["']).*?\1/i, "");
      return `<html${clean} data-fx-build="${version}">`;
    })
    .replace(/assets\/js\/main\.js\?v=[^"'\s]+/g, `assets/js/main.js?v=${version}`);
  if (next !== original) {
    writeFileSync(file, next);
    stamped++;
  }
}

mkdirSync(root, { recursive: true });
writeFileSync(join(root, "version.json"), JSON.stringify({ version }) + "\n");
console.log(`Stamped ${stamped} HTML pages with deployment ${version}`);
