// Ticket 14: classify every SOURCE site where Foundation interpolates
// $global-left / $global-right, into "the rebind is safe here" vs
// "the rebind emits invalid CSS here".
//
// Source-site classification (not emitted-CSS classification) is what tells a
// planner how much of Foundation needs a per-property translation layer, and
// which components are affected -- including LATENT sites behind @if guards that
// a default compile never reaches.
//
// Read-only. Usage: node rtl-rebind-source-sites.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname as pathDirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = pathDirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const FND = join(repoRoot, 'node_modules/foundation-sites/scss');

function walk(dir) {
  const out = [];

  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (statSync(p).isDirectory()) {
      out.push(...walk(p));
    } else if (name.endsWith('.scss')) {
      out.push(p);
    }
  }

  return out;
}

// Ordered: first match wins.
const CLASSES = [
  // --- SAFE: a logical property/value of the same shape exists. ---
  { id: 'SAFE margin/padding longhand', re: /\b(margin|padding)-#\{\$global-(left|right)\}\s*:/ },
  { id: 'SAFE border longhand/shorthand', re: /\bborder-#\{\$global-(left|right)\}(-(color|width|style))?\s*:/ },
  { id: 'SAFE float/clear value', re: /\b(float|clear)\s*:\s*\$global-(left|right)\b/ },
  { id: 'SAFE scroll-margin/padding', re: /\bscroll-(margin|padding)-#\{\$global-(left|right)\}\s*:/ },

  // --- BROKEN: no logical counterpart of that shape. ---
  { id: 'BROKEN bare side as positioning property (needs inset-inline-*)', re: /^\s*#\{\$global-(left|right)\}\s*:/m },
  { id: 'BROKEN corner radius (needs border-<block>-<inline>-radius)', re: /\bborder-(top|bottom)-#\{\$global-(left|right)\}-radius\s*:/ },
  { id: 'BROKEN text-align value (needs start/end, not inline-start/end)', re: /\btext-align\s*:\s*[^;]*\$global-(left|right)\b/ },
  { id: 'BROKEN background-position value (accepts no logical keyword)', re: /\bbackground-position\s*:\s*[^;]*\$global-(left|right)\b/ },
];

const buckets = new Map();

for (const file of walk(FND)) {
  const rel = relative(FND, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    if (!line.includes('$global-left') && !line.includes('$global-right')) {
      return;
    }

    // Skip the two derivation sites in _global.scss -- they ARE the rebind hook.
    if (rel === '_global.scss' && /^\s*\$global-(left|right)\s*:/.test(line)) {
      return;
    }

    const hit = CLASSES.find((c) => c.re.test(line));
    const id = hit ? hit.id : 'UNCLASSIFIED (review by hand)';

    if (!buckets.has(id)) {
      buckets.set(id, []);
    }

    buckets.get(id).push(`${rel}:${i + 1}  ${line.trim()}`);
  });
}

let safe = 0;
let broken = 0;
let other = 0;

for (const id of [...buckets.keys()].sort()) {
  const rows = buckets.get(id);
  const files = new Set(rows.map((r) => r.split(':')[0]));
  console.log(`\n=== ${id} ===`);
  console.log(`${rows.length} source sites across ${files.size} files`);

  if (id.startsWith('SAFE')) {
    safe += rows.length;
    console.log(`  files: ${[...files].sort().join(', ')}`);
  } else {
    if (id.startsWith('BROKEN')) {
      broken += rows.length;
    } else {
      other += rows.length;
    }

    for (const r of rows) {
      console.log(`  ${r}`);
    }
  }
}

console.log(`\n=== SUMMARY (source sites) ===`);
console.log(`SAFE under the rebind:   ${safe}`);
console.log(`BROKEN under the rebind: ${broken}`);
console.log(`UNCLASSIFIED:            ${other}`);
