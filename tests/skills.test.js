import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { buySkill, skillEffect, successChance, nerveMax, doMission, bailCost } from '../js/engine.js';
import { SKILLS, MISSIONS, NERVE_MAX_BASE } from '../js/data.js';

const T0 = 1_000_000;
const mission = (id) => MISSIONS.find((m) => m.id === id);
const skill = (branch, idx) => SKILLS.find((k) => k.branch === branch && k.idx === idx);
const rich = () => { const s = newState(T0); s.sp = 10_000; return s; };

test('there are 3 branches with 5 skills each', () => {
  for (const b of ['stealth', 'muscle', 'brains']) {
    assert.deepEqual(SKILLS.filter((k) => k.branch === b).map((k) => k.idx), [1, 2, 3, 4, 5]);
  }
});

test('skills must be bought in order', () => {
  const r = buySkill(rich(), skill('stealth', 2).id, T0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'order');
});

test('a skill needs enough SP and deducts it', () => {
  const s = newState(T0);
  const k = skill('stealth', 1);
  s.sp = k.cost - 1;
  assert.equal(buySkill(s, k.id, T0).reason, 'sp');
  s.sp = k.cost;
  const r = buySkill(s, k.id, T0);
  assert.equal(r.ok, true);
  assert.equal(r.state.sp, 0);
  assert.equal(r.state.skills[k.id], true);
  assert.equal(buySkill(r.state, k.id, T0).reason, 'owned');
});

test('stealth node 1 helps stealth missions only', () => {
  const s = rich();
  const before = [successChance(s, mission('pickpocket')), successChance(s, mission('bike'))];
  const t = buySkill(s, skill('stealth', 1).id, T0).state;
  assert.ok(Math.abs(successChance(t, mission('pickpocket')) - Math.min(0.95, before[0] + 0.04)) < 1e-9);
  assert.equal(successChance(t, mission('bike')), before[1]);
});

test('brains node 2 raises max nerve by 10', () => {
  let s = rich();
  s = buySkill(s, skill('brains', 1).id, T0).state;
  assert.equal(nerveMax(s), NERVE_MAX_BASE);
  s = buySkill(s, skill('brains', 2).id, T0).state;
  assert.equal(nerveMax(s), NERVE_MAX_BASE + 10);
});

test('skill effects add up across owned skills', () => {
  let s = rich();
  for (let i = 1; i <= 3; i++) s = buySkill(s, skill('stealth', i).id, T0).state;
  assert.ok(Math.abs(skillEffect(s, 'heatReduction') - 3 * skill('stealth', 1).effects.heatReduction) < 1e-9);
});

test('heat reduction lowers the heat a mission adds', () => {
  let s = rich();
  s = buySkill(s, skill('stealth', 1).id, T0).state;
  const r = doMission(s, 'pickpocket', () => 0, T0);
  assert.ok(r.state.heat < mission('pickpocket').heat);
});

test('payout bonus raises mission cash', () => {
  let s = rich();
  s = buySkill(s, skill('brains', 1).id, T0).state;
  const r = doMission(s, 'pickpocket', () => 0, T0);
  assert.equal(r.state.cash, Math.round(mission('pickpocket').cash[0] * (1 + skillEffect(s, 'payoutBonus'))));
});

test('bail discount lowers bail', () => {
  let s = rich();
  s.cash = 100_000;
  const full = bailCost(s);
  for (let i = 1; i <= 3; i++) s = buySkill(s, skill('brains', i).id, T0).state;
  assert.ok(bailCost(s) < full);
});
