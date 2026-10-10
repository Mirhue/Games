import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { doMission, tick, successChance, inJail, bailCost, payBail, bribeCost, bribeCops, netWorth } from '../js/engine.js';
import { MISSIONS, JAIL_MS_PER_TIER, SEIZE_FRACTION, HEAT_DECAY_MS } from '../js/data.js';

const T0 = 1_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const mission = (id) => MISSIONS.find((m) => m.id === id);

test('heat lowers success chance by 0.003 per point', () => {
  const s = newState(T0);
  const m = mission('bike');
  const cold = successChance(s, m);
  s.heat = 50;
  assert.ok(Math.abs(successChance(s, m) - (cold - 0.15)) < 1e-9);
});

test('a successful mission adds the mission heat', () => {
  const r = doMission(newState(T0), 'bike', () => 0, T0);
  assert.equal(r.state.heat, mission('bike').heat);
});

test('a failed mission that is caught sends you to jail and seizes cash on hand only', () => {
  const s = newState(T0);
  s.cash = 1000;
  s.vault = { tier: 1, balance: 500 };
  const r = doMission(s, 'bike', seq(0.99, 0), T0);  // fail, then arrested
  assert.equal(r.arrested, true);
  assert.equal(r.state.jailUntil, T0 + JAIL_MS_PER_TIER * 1);
  assert.equal(r.state.cash, 1000 * (1 - SEIZE_FRACTION));
  assert.equal(r.state.vault.balance, 500);
  assert.equal(r.state.stats.arrests, 1);
  assert.ok(inJail(r.state, T0 + 1));
  assert.ok(!inJail(r.state, T0 + JAIL_MS_PER_TIER));
});

test('a failed mission that escapes adds half the heat and no jail', () => {
  const r = doMission(newState(T0), 'bike', seq(0.99, 0.99), T0);
  assert.equal(r.arrested, false);
  assert.equal(r.state.jailUntil, 0);
  assert.equal(r.state.heat, mission('bike').heat / 2);
});

test('higher heat makes an arrest more likely', () => {
  const s = newState(T0);
  // arrestBase(tier 1) = 0.15, so a roll of 0.3 escapes when cold...
  assert.equal(doMission(s, 'bike', seq(0.99, 0.3), T0).arrested, false);
  // ...but not at 50 heat (0.15 + 50 * 0.004 = 0.35).
  s.heat = 50;
  assert.equal(doMission(s, 'bike', seq(0.99, 0.3), T0).arrested, true);
});

test('missions are refused while in jail', () => {
  const s = newState(T0);
  s.jailUntil = T0 + 10_000;
  const r = doMission(s, 'pickpocket', () => 0, T0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'jail');
});

test('bail costs at least $100 or 10% of net worth, and releases you', () => {
  const s = newState(T0);
  s.jailUntil = T0 + 10_000;
  s.cash = 500;
  assert.equal(bailCost(s), 100);
  s.cash = 5000;
  s.vault = { tier: 1, balance: 5000 };
  assert.equal(netWorth(s), 10000);
  assert.equal(bailCost(s), 1000);
  const r = payBail(s, T0);
  assert.equal(r.ok, true);
  assert.equal(r.state.cash, 4000);
  assert.ok(!inJail(r.state, T0));
});

test('bail is refused when you cannot pay or are not in jail', () => {
  const s = newState(T0);
  assert.equal(payBail(s, T0).ok, false);
  s.jailUntil = T0 + 10_000;
  s.cash = 50;
  assert.equal(payBail(s, T0).reason, 'cash');
});

test('bribing the cops clears heat for a price', () => {
  const s = newState(T0);
  s.heat = 40;
  s.cash = 1_000_000;
  const cost = bribeCost(s);
  assert.ok(cost > 0);
  const r = bribeCops(s, T0);
  assert.equal(r.state.heat, 0);
  assert.equal(r.state.cash, 1_000_000 - cost);
  s.cash = 0;
  assert.equal(bribeCops(s, T0).ok, false);
});

test('heat decays by 1 per 10 seconds and never goes below 0', () => {
  const s = newState(T0);
  s.heat = 5;
  assert.equal(tick(s, T0 + HEAT_DECAY_MS * 3).heat, 2);
  assert.equal(tick(s, T0 + HEAT_DECAY_MS * 100).heat, 0);
});

test('heat never exceeds 100', () => {
  const s = newState(T0);
  s.heat = 99;
  assert.equal(doMission(s, 'bike', () => 0, T0).state.heat, 100);
});
