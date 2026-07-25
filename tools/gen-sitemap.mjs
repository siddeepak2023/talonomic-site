#!/usr/bin/env node
/**
 * Regenerates sitemap.xml for this site. Zero dependencies — node builtins only,
 * no package.json, no install. Run from the site root before deploying:
 *
 *   node tools/gen-sitemap.mjs && firebase deploy --only hosting
 *
 * It is also the canonical linter: every page it emits must carry a
 * <link rel="canonical"> whose href equals the URL computed here. A mismatch
 * exits non-zero rather than shipping a sitemap that disagrees with the pages.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://profit.bizfalconai.com";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["app", "tools", "node_modules", ".git", "shots", "media", "textures"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out);
    } else if (entry.endsWith(".html") && !entry.startsWith("_") && !entry.startsWith("test-")) {
      out.push(full);
    }
  }
  return out;
}

/** Path must match how the page is linked internally and what it canonicals to. */
function urlPath(file) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return "/" + rel.slice(0, -"index.html".length);
  return "/" + rel;
}

function lastmod(file) {
  try {
    // %ad + --date=short, not %cs: %cs is unsupported by older git and leaks
    // the literal "%cs" into <lastmod>.
    const out = execFileSync("git", ["log", "-1", "--date=short", "--format=%ad", "--", file], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (out) return out;
  } catch {
    /* not a repo, or file never committed — fall through to mtime */
  }
  return statSync(file).mtime.toISOString().slice(0, 10);
}

const files = walk(ROOT).sort();
const problems = [];
const entries = [];

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);

  const robots = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  if (robots && /noindex/i.test(robots[1])) continue;

  const expected = ORIGIN + urlPath(file);
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);

  if (!canonical) {
    problems.push(`${rel}: no <link rel="canonical">`);
    continue;
  }
  if (canonical[1] !== expected) {
    problems.push(`${rel}: canonical is ${canonical[1]}, expected ${expected}`);
    continue;
  }
  entries.push({ loc: expected, lastmod: lastmod(file) });
}

if (problems.length) {
  console.error("canonical check failed:\n  " + problems.join("\n  "));
  process.exit(1);
}

// changefreq and priority are deliberately omitted — Google ignores both, and
// they are two more fields to go stale.
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries
    .map((e) => `  <url>\n    <loc>${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>\n`)
    .join("") +
  "</urlset>\n";

writeFileSync(join(ROOT, "sitemap.xml"), xml);
console.log(`sitemap.xml — ${entries.length} urls, all canonicals agree`);
