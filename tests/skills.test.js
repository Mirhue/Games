import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { buySkill, skillLevel, skillCost, effect, successChance, nerveMax, nerveRegenMs, heatDecayRate, doMission, bailCost } from '../js/engine.js';
import { SKILLS, SKILL_GROWTH, MISSIONS, NERVE_MAX_BASE, NERVE_REGEN_MS } from '../js/data.js';

const T0 = 1_000_000;
const mission = (id) => MISSIONS.find((m) => m.id === id);
const node = (branch, idx) => SKILLS.find((k) => k.branch === branch && k.idx === idx);
const rich = () => { const s = newState(T0); s.sp = 1e9; return s; };
const learn = (s, branch, idx, levels = 1) => {
  for (let i = 0; i < levels; i++) {
    const r = buySkill(s, node(branch, idx).id, T0);
    assert.equal(r.ok, true, `${branch}${idx} level ${i + 1}: ${r.reason}`);
    s = r.state;
  }
  return s;
};

test('four branches with the spec max levels', () => {
  for (const b of ['stealth', 'muscle', 'brains']) {
    assert.deepEqual(SKILLS.filter((k) => k.branch === b).map((k) => k.maxLevel), [5, 5, 5, 3, 1], b);
  }
  assert.deepEqual(SKILLS.filter((k) => k.branch === 'street').map((k) => k.maxLevel), [5, 5, 3]);
});

test('a node unlocks once the previous node reaches level 1', () => {
  let s = rich();
  assert.equal(buySkill(s, node('stealth', 2).id, T0).reason, 'order');
  s = learn(s, 'stealth', 1);
  assert.equal(buySkill(s, node('stealth', 2).id, T0).ok, true);
});

test('the previous node can keep leveling after the next one unlocks', () => {
  let s = learn(rich(), 'stealth', 1);
  s = learn(s, 'stealth', 2);
  s = learn(s, 'stealth', 1, 2);
  assert.equal(skillLevel(s, node('stealth', 1).id), 3);
  assert.equal(skillLevel(s, node('stealth', 2).id), 1);
});

test('each level costs 1.6x the previous one and deducts SP', () => {
  let s = rich();
  const k = node('muscle', 1);
  assert.equal(skillCost(s, k.id), k.baseCost);
  s = learn(s, 'muscle', 1);
  assert.equal(skillCost(s, k.id), Math.round(k.baseCost * SKILL_GROWTH));
  assert.equal(s.sp, 1e9 - k.baseCost);
});

test('not enough SP is refused', () => {
  const s = newState(T0);
  s.sp = node('brains', 1).baseCost - 1;
  assert.equal(buySkill(s, node('brains', 1).id, T0).reason, 'sp');
});

test('a maxed skill cannot be upgraded further', () => {
  let s = rich();
  for (let i = 1; i <= 4; i++) s = learn(s, 'stealth', i);
  s = learn(s, 'stealth', 5);
  assert.equal(skillCost(s, node('stealth', 5).id), null);
  assert.equal(buySkill(s, node('stealth', 5).id, T0).reason, 'max');
});

test('effects scale with level and only help their own job type', () => {
  let s = rich();
  const before = [successChance(s, mission('pickpocket')), successChance(s, mission('bike'))];
  s = learn(s, 'stealth', 1, 3);
  const per = node('stealth', 1).effects.stealthChance;
  assert.ok(Math.abs(successChance(s, mission('pickpocket')) - Math.min(0.95, before[0] + 3 * per)) < 1e-9);
  assert.equal(successChance(s, mission('bike')), before[1]);
});

test('Stamina speeds up nerve regeneration', () => {
  const s = learn(rich(), 'street', 1, 2);
  assert.ok(Math.abs(nerveRegenMs(s) - NERVE_REGEN_MS / (1 + 2 * node('street', 1).effects.nerveRegen)) < 1e-9);
});

test('Cool Head speeds up heat decay', () => {
  let s = learn(rich(), 'street', 1);
  s = learn(s, 'street', 2, 3);
  assert.ok(Math.abs(heatDecayRate(s) - (1 + 3 * node('street', 2).effects.heatDecay)) < 1e-9);
});

test('Second Wind and Brains raise max nerve', () => {
  let s = learn(rich(), 'street', 1);
  s = learn(s, 'street', 2);
  s = learn(s, 'street', 3, 2);
  assert.equal(nerveMax(s), NERVE_MAX_BASE + 2 * node('street', 3).effects.nerveMax);
  s = learn(s, 'brains', 1);
  s = learn(s, 'brains', 2);
  assert.equal(nerveMax(s), NERVE_MAX_BASE + 2 * node('street', 3).effects.nerveMax + node('brains', 2).effects.nerveMax);
});

test('heat reduction lowers the heat a job adds', () => {
  const s = learn(rich(), 'stealth', 1, 2);
  assert.ok(doMission(s, 'pickpocket', () => 0, T0).state.heat < mission('pickpocket').heat);
});

test('payout bonus raises job cash', () => {
  const s = learn(rich(), 'brains', 1, 2);
  const r = doMission(s, 'pickpocket', () => 0, T0);
  assert.equal(r.state.cash, Math.round(mission('pickpocket').cash[0] * (1 + effect(s, 'payoutBonus'))));
});

test('bail discount lowers bail', () => {
  let s = rich();
  s.cash = 100_000;
  const full = bailCost(s);
  s = learn(s, 'brains', 1, 3);
  assert.ok(bailCost(s) < full);
});
