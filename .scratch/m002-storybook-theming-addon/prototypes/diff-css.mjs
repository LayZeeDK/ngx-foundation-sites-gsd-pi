// Job 2: byte-for-byte diff of browser CSS vs the two Node references.
// Job 3: assert the $global-left/$global-right RTL rebind in the browser CSS.
//
// Usage: node diff-css.mjs <outDir> [terser|esbuild]

import { readFileSync } from 'node:fs';
import { dirname as pathDirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = pathDirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? join(here, 'out');
const mode = process.argv[3] ?? 'terser';

const browser = JSON.parse(
  readFileSync(join(outDir, `browser-report.${mode}.json`), 'utf8'),
).css;
const node = JSON.parse(readFileSync(join(outDir, 'node-reference.json'), 'utf8'));

const sha = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex').slice(0, 16);

let allIdentical = true;

for (const name of Object.keys(node)) {
  const b = browser[name];
  const a = node[name].stringMap;
  const c = node[name].filesystem;
  const bBytes = Buffer.byteLength(b, 'utf8');

  const same = b === a;
  const sameFs = b === c;
  allIdentical = allIdentical && same && sameFs;

  console.log(
    `[${name}] browser=${bBytes}B sha=${sha(b)} | node-stringmap sha=${sha(a)} identical=${same} | node-filesystem sha=${sha(c)} identical=${sameFs}`,
  );

  if (!same) {
    const bl = b.split('\n');
    const al = a.split('\n');

    for (let i = 0; i < Math.max(bl.length, al.length); i += 1) {
      if (bl[i] !== al[i]) {
        console.log(`  first divergence line ${i + 1}:`);
        console.log(`    browser: ${JSON.stringify(bl[i])}`);
        console.log(`    node   : ${JSON.stringify(al[i])}`);
        break;
      }
    }
  }
}

console.log(`\nALL IDENTICAL: ${allIdentical}\n`);

// ---- RTL rebind assertion (job 3) ----
const css = browser.themed;
const dropdown = css.slice(css.indexOf('.button.dropdown'));
const block = dropdown.slice(0, dropdown.indexOf('\n}\n', dropdown.indexOf('::after')) + 3);

console.log('--- .button.dropdown block as emitted IN THE BROWSER ---');
console.log(block.trim());

const checks = {
  'float: inline-end present': /float:\s*inline-end/.test(css),
  'margin-inline-start present': /margin-inline-start:/.test(css),
  'NO physical float: right': !/float:\s*right/.test(css),
  'NO physical float: left': !/float:\s*left/.test(css),
  'NO margin-left in dropdown block': !/margin-left:/.test(block),
  'NO [dir] selector anywhere': !/\[dir/.test(css),
  'NO :dir( selector anywhere': !/:dir\(/.test(css),
};

console.log('\n--- RTL assertions ---');

for (const [k, v] of Object.entries(checks)) {
  console.log(`${v ? '[OK]  ' : '[FAIL]'} ${k}`);
}

// Count directional declarations overall.
const logical = [...css.matchAll(/(inline-start|inline-end)/g)].length;
console.log(`\nlogical-direction tokens in the sheet: ${logical}`);
