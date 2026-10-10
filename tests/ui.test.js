import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt } from '../js/ui.js';

test('fmt shows small amounts in full and large ones with a suffix', () => {
  assert.equal(fmt(0), '$0');
  assert.equal(fmt(1234), '$1,234');
  assert.equal(fmt(15_300), '$15.3K');
  assert.equal(fmt(2_500_000), '$2.5M');
  assert.equal(fmt(500_000_000), '$500M');
  assert.equal(fmt(3_000_000_000), '$3B');
});

test('describePerks turns effect objects into readable text', async () => {
  const { describePerks } = await import('../js/ui.js');
  assert.equal(describePerks({ stealthChance: 0.015, heatReduction: 0.02 }), '+1.5% stealth jobs, −2% job heat');
  assert.equal(describePerks({ muscleChance: 0.01, power: 6, defense: 6 }), '+1% muscle jobs, +6 power & defense');
  assert.equal(describePerks({ nerveRegen: 0.06 }), '+6% nerve regen');
  assert.equal(describePerks({}), '');
});
