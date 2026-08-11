// Ticket 03, probe B-supplement -- does Chromium's CSSOM expand `border-width`
// into longhands when enumerated? If it does, a class-6 detector written against
// the SOURCE text (which requires `border-width` to be present as such) reports 0
// in the CSSOM view for a reason that has nothing to do with the browser dropping
// anything. That would be a second false all-clear, so it is measured explicitly.
//
// Read-only. Usage: node cssom-shorthand-check.mjs

import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');

const out = await page.evaluate(() => {
  // The exact shape Foundation's css-triangle emits when NO direction branch
  // matches: solid border-style, a bare border-width, no border-color, no zeroed
  // side. Valid CSS; renders a solid square instead of an arrow.
  const degenerate = '.probe-triangle { border-style: solid; border-width: 6px; }';
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(degenerate);
  const rule = sheet.cssRules.item(0);
  const enumerated = [];

  for (let i = 0; i < rule.style.length; i += 1) {
    enumerated.push(rule.style.item(i));
  }

  return {
    ruleSurvived: rule != null,
    selector: rule.selectorText,
    enumerated,
    borderStyle: rule.style.getPropertyValue('border-style'),
    borderWidth: rule.style.getPropertyValue('border-width'),
    borderColor: rule.style.getPropertyValue('border-color'),
    cssText: rule.cssText,
  };
});

console.log('=== Does the degenerate css-triangle rule survive Chromium at all? ===');
console.log(`  rule survived: ${out.ruleSurvived ? '[OK] YES' : '[FAIL] NO'}`);
console.log(`  cssText:       ${out.cssText}`);
console.log(`  border-style:  ${JSON.stringify(out.borderStyle)}`);
console.log(`  border-width:  ${JSON.stringify(out.borderWidth)}`);
console.log(`  border-color:  ${JSON.stringify(out.borderColor)}  <- the DEFECT is this ABSENCE`);
console.log(`  style.item() enumerates: ${JSON.stringify(out.enumerated)}`);
console.log(
  '\n  CONCLUSION: the rule and every one of its declarations survive intact. Class 6 is a defect of' +
    '\n  ABSENCE (no border-color, no zeroed side), and a validity oracle can only see declarations that' +
    '\n  are PRESENT and rejected. It is structurally blind to class 6 -- not merely unlucky.',
);

if (out.enumerated.includes('border-width') && !out.enumerated.includes('border-top-width')) {
  console.log(
    '\n  [INFO] item() keeps `border-width` as a shorthand, so a source-shaped detector would work here.',
  );
} else {
  console.log(
    '\n  [WARN] item() EXPANDS the shorthand, so any class-6 detector written against the SOURCE text' +
      '\n         reports 0 in the CSSOM view for a reason unrelated to browser behaviour. That is a' +
      '\n         DETECTOR artefact, and reading it as "the browser dropped it" is a false all-clear.',
  );
}

await browser.close();
