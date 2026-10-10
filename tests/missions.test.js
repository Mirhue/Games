import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { doMission, tick, rankIndex, nerveMax, successChance } from '../js/engine.js';
import { MISSIONS, RANKS, NERVE_REGEN_MS } from '../js/data.js';

const T0 = 1_000_000;
const always = () => 0;     // every roll succeeds, payouts at minimum
const never = () => 0.999;  // every roll fails
const mission = (id) => MISSIONS.find((m) => m.id === id);

test('there are 6 tiers with 3 missions each', () => {
  for (let tier = 1; tier <= 6; tier++) {
    assert.equal(MISSIONS.filter((m) => m.tier === tier).length, 3, `tier ${tier}`);
  }
});

test('a mission above your rank is locked', () => {
  const s = newState(T0);
  const r = doMission(s, MISSIONS.find((m) => m.tier === 2).id, always, T0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'locked');
  assert.equal(r.state, s);
});

test('a mission without enough nerve is refused and changes nothing', () => {
  const s = newState(T0);
  s.nerve = 0;
  const r = doMission(s, 'pickpocket', always, T0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'nerve');
  assert.equal(r.state.nerve, 0);
});

test('a successful mission pays cash, respect and sp and costs nerve', () => {
  const s = newState(T0);
  const m = mission('pickpocket');
  const r = doMission(s, 'pickpocket', always, T0);
  assert.equal(r.ok, true);
  assert.equal(r.success, true);
  assert.equal(r.state.cash, m.cash[0]);
  assert.equal(r.state.respect, m.respect);
  assert.equal(r.state.sp, m.sp);
  assert.equal(r.state.nerve, s.nerve - m.nerve);
  assert.equal(r.state.stats.successes, 1);
  assert.equal(s.cash, 0, 'input state is not mutated');
});

test('a failed mission pays nothing but still costs nerve', () => {
  const s = newState(T0);
  const r = doMission(s, 'pickpocket', never, T0);
  assert.equal(r.ok, true);
  assert.equal(r.success, false);
  assert.equal(r.state.cash, 0);
  assert.equal(r.state.respect, 0);
  assert.equal(r.state.nerve, s.nerve - mission('pickpocket').nerve);
});

test('rank rises when respect crosses a threshold', () => {
  const s = newState(T0);
  assert.equal(rankIndex(s), 0);
  s.respect = RANKS[1].respect;
  assert.equal(rankIndex(s), 1);
  const r = doMission(s, MISSIONS.find((m) => m.tier === 2).id, always, T0);
  assert.equal(r.ok, true);
});

test('crossing a rank threshold during a mission logs a promotion', () => {
  const s = newState(T0);
  s.respect = RANKS[1].respect - 1;
  const r = doMission(s, 'pickpocket', always, T0);
  assert.ok(r.events.some((e) => /promoted/i.test(e.text)));
});

test('success chance is clamped to [0.05, 0.95]', () => {
  const s = newState(T0);
  for (const m of MISSIONS) {
    const c = successChance(s, m);
    assert.ok(c >= 0.05 && c <= 0.95, `${m.id}: ${c}`);
  }
});

test('tick regenerates 1 nerve per 6 seconds, keeping leftover time', () => {
  const s = newState(T0);
  s.nerve = 10;
  let t = tick(s, T0 + NERVE_REGEN_MS * 1.5);
  assert.equal(Math.floor(t.nerve), 11);
  t = tick(t, T0 + NERVE_REGEN_MS * 3);
  assert.equal(Math.floor(t.nerve), 13);
});

test('tick never fills nerve above the max', () => {
  const s = newState(T0);
  const t = tick(s, T0 + 3_600_000);
  assert.equal(t.nerve, nerveMax(t));
});

test('tick with a clock that went backwards changes nothing', () => {
  const s = newState(T0);
  s.nerve = 10;
  const t = tick(s, T0 - 5000);
  assert.equal(t.nerve, 10);
  assert.equal(t.lastTick, T0);
});
