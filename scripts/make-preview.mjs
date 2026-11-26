// Makes a static preview of the site that works from any sub-path (no server,
// no Netlify functions). Usage:
//   PREVIEW=1 npx astro build && node scripts/make-preview.mjs <outDir>
// Rewrites root-relative links ("/recipes/x") to page-relative ones
// ("../recipes/x.html") and gives scripts a matching window.__lkLink helper.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";

const src = new URL("../dist/", import.meta.url).pathname;
const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/make-preview.mjs <outDir>");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

// Same mapping in Node and in the browser.
const toRel = (p) => {
  if (!p.startsWith("/") || p.startsWith("//")) return p;
  const m = p.match(/^([^?#]*)(.*)$/);
  let path = m[1], rest = m[2];
  if (path.startsWith("/api/")) return p; /* backend only exists on Netlify */
  if (path === "/" || path === "") return "index.html" + rest;
  path = path.replace(/\/$/, "").slice(1);
  if (!/\.[a-z0-9]+$/i.test(path)) path += ".html";
  return path + rest;
};

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(out);
let pages = 0;
for (const f of files) {
  const ext = extname(f);
  if (ext === ".html") {
    const depth = relative(out, dirname(f)).split("/").filter(Boolean).length;
    let html = readFileSync(f, "utf8");
    const up = "../".repeat(depth);
    html = html.replace(/\b(href|src|action)="(\/[^"]*)"/g, (_, a, p) => {
      const r = toRel(p);
      return `${a}="${r.startsWith("/") ? r : up + r}"`;
    });
    const head = `<script>(function(){var up=${JSON.stringify(up)};var toRel=${toRel.toString().replace(/\n\s*/g, " ")};window.__lkLink=function(p){var r=toRel(p);return r.charAt(0)==="/"?r:up+r;};})();</script>`;
    html = html.replace(/<head>/, `<head>${head}`);
    const note = `<div style="background:#2a221c;color:#fbf6ec;font:14px/1.4 system-ui,sans-serif;padding:8px 16px;text-align:center">Preview · family answers, photo uploads, the editor and the chat switch on once the site is on Netlify</div>`;
    html = html.replace(/(<body[^>]*>)/, `$1${note}`);
    writeFileSync(f, html);
    pages++;
  } else if (ext === ".css") {
    let css = readFileSync(f, "utf8");
    const rel = relative(dirname(f), out) || ".";
    css = css.replace(/url\((["']?)\/(?!\/)([^)"']+)\1\)/g, (_, q, p) => `url(${q}${rel}/${p}${q})`);
    writeFileSync(f, css);
  }
}
console.log(`preview: ${pages} pages, ${files.length} files in ${out}`);
