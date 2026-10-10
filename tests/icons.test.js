import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { MISSIONS, WEAPONS, SKILLS, INVESTMENTS, RIVALS } from '../js/data.js';

const all = { MISSIONS, WEAPONS, SKILLS, INVESTMENTS, RIVALS };

for (const [group, items] of Object.entries(all)) {
  test(`every entry in ${group} has an icon file`, () => {
    for (const item of items) {
      assert.ok(item.icon, `${group}.${item.id} has no icon`);
      const path = new URL(`../assets/icons/${item.icon}.svg`, import.meta.url);
      assert.ok(existsSync(path), `missing assets/icons/${item.icon}.svg`);
      const svg = readFileSync(path, 'utf8');
      assert.match(svg, /^<svg[^>]*viewBox="0 0 512 512"/);
      assert.ok(!svg.includes('M0 0h512v512H0z'), `${item.icon}.svg still has its background square`);
    }
  });
}
