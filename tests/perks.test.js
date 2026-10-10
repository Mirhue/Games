import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { effect, perk, capped, nerveRegenMs, heatDecayRate, nerveMax } from '../js/engine.js';
import { PERK_CAPS, NERVE_REGEN_MS, NERVE_MAX_BASE, INVESTMENTS } from '../js/data.js';

const T0 = 1_000_000;

test('perk caps match the spec', () => {
  assert.deepEqual(
    { nerveRegen: PERK_CAPS.nerveRegen, heatDecay: PERK_CAPS.heatDecay, heatReduction: PERK_CAPS.heatReduction, nerveMax: PERK_CAPS.nerveMax },
    { nerveRegen: 1, heatDecay: 2, heatReduction: 0.75, nerveMax: 150 },
  );
});

test('capped() limits a value to its cap and leaves uncapped keys alone', () => {
  assert.equal(capped('nerveRegen', 5), 1);
  assert.equal(capped('nerveRegen', 0.3), 0.3);
  assert.equal(capped('payoutBonus', 7), 7);
});

test('a fresh state has no perks', () => {
  const s = newState(T0);
  for (const key of Object.keys(PERK_CAPS)) assert.equal(effect(s, key), 0, key);
  assert.equal(nerveRegenMs(s), NERVE_REGEN_MS);
  assert.equal(heatDecayRate(s), 1);
  assert.equal(nerveMax(s), NERVE_MAX_BASE);
});

test('business heat perks add up per copy and respect the cap', () => {
  const launder = INVESTMENTS.find((i) => (i.perks?.heatDecay ?? 0) > 0);
  const s = newState(T0);
  s.investments[launder.id] = 2;
  assert.ok(Math.abs(effect(s, 'heatDecay') - 2 * launder.perks.heatDecay) < 1e-9);
  s.investments[launder.id] = 10_000;
  assert.equal(perk(s, 'heatDecay'), PERK_CAPS.heatDecay);
  assert.equal(heatDecayRate(s), 1 + PERK_CAPS.heatDecay);
});
