import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import {
  doMission, attackRival, resolveEncounter, encounterOdds, fleeOdds, payCost, power, jailMs,
} from '../js/engine.js';
import { ENCOUNTERS, ENCOUNTER_CHANCE, ENCOUNTER_POWER, ENCOUNTER_LOSS_CAP, MISSIONS, RANKS } from '../js/data.js';

const T0 = 1_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const job = (id) => MISSIONS.find((m) => m.id === id);
const type = (id) => ENCOUNTERS.find((e) => e.id === id);
const thief = () => { const s = newState(T0); s.respect = RANKS[1].respect; return s; };
const pending = (id, s = thief()) => {
  const m = job('car_breakin');
  s.encounter = { type: id, tier: m.tier, stake: (m.cash[0] + m.cash[1]) / 2, respect: m.respect, power: Math.round(ENCOUNTER_POWER[m.tier - 1] * type(id).mult) };
  return s;
};

test('four encounter types from the spec', () => {
  assert.deepEqual(ENCOUNTERS.map((e) => e.id), ['mugger', 'crew', 'cop', 'snitch']);
  assert.equal(ENCOUNTER_CHANCE, 0.06);
  assert.deepEqual(ENCOUNTER_POWER, [15, 40, 120, 300, 700, 1500]);
});

test('a tier-2+ job can lead to an encounter', () => {
  // success, cash roll, encounter roll (under the chance), type roll (second type)
  const r = doMission(thief(), 'car_breakin', seq(0, 0, 0.01, 0.3), T0);
  const m = job('car_breakin');
  assert.deepEqual(r.state.encounter, {
    type: 'crew', tier: 2, stake: (m.cash[0] + m.cash[1]) / 2, respect: m.respect,
    power: Math.round(ENCOUNTER_POWER[1] * type('crew').mult),
  });
  assert.equal(doMission(thief(), 'car_breakin', seq(0, 0, 0.5), T0).state.encounter, null);
});

test('tier-1 jobs and arrests never lead to an encounter', () => {
  assert.equal(doMission(thief(), 'pickpocket', () => 0, T0).state.encounter, null);
  const busted = doMission(thief(), 'car_breakin', seq(0.99, 0, 0), T0);
  assert.equal(busted.arrested, true);
  assert.equal(busted.state.encounter, null);
});

test('while an encounter is pending, jobs and gang fights are refused', () => {
  const s = pending('mugger');
  s.nerve = 100;
  assert.equal(doMission(s, 'pickpocket', () => 0, T0).reason, 'encounter');
  s.respect = RANKS.at(-1).respect;
  assert.equal(attackRival(s, 'rats', () => 0, T0).reason, 'encounter');
});

test('winning a fight pays part of the stake and respect', () => {
  const s = pending('mugger');
  const r = resolveEncounter(s, 'fight', () => 0, T0);
  assert.equal(r.ok, true);
  assert.equal(r.won, true);
  assert.equal(r.state.encounter, null);
  assert.equal(r.state.cash, Math.round(s.encounter.stake * 0.5));
  assert.equal(r.state.respect, s.respect + s.encounter.respect);
});

test('fight odds follow power plus the fightOdds perk', () => {
  const s = pending('crew');
  const base = power(s) / (power(s) + s.encounter.power);
  assert.ok(Math.abs(encounterOdds(s) - base) < 1e-9);
  s.skills = { warfare1: 2 };
  assert.ok(Math.abs(encounterOdds(s) - (base + 0.04)) < 1e-9);
});

test('losing to a mugger costs 10% of cash and some heat', () => {
  const s = pending('mugger');
  s.cash = 1000;
  const r = resolveEncounter(s, 'fight', () => 0.999, T0);
  assert.equal(r.won, false);
  assert.equal(r.state.cash, 900);
  assert.equal(r.state.heat, 5);
});

test('losing to an undercover cop means jail and seized cash', () => {
  const s = pending('cop');
  s.cash = 1000;
  const r = resolveEncounter(s, 'fight', () => 0.999, T0);
  assert.equal(r.state.jailUntil, T0 + jailMs(s, 2));
  assert.equal(r.state.cash, 750);
  assert.equal(r.state.stats.arrests, 1);
});

test('beating a cop gives respect but heat', () => {
  const r = resolveEncounter(pending('cop'), 'fight', () => 0, T0);
  assert.equal(r.state.heat, 15);
  assert.equal(r.state.cash, 0);
});

test('a snitch you fail to silence brings 25 heat', () => {
  const r = resolveEncounter(pending('snitch'), 'flee', () => 0.999, T0);
  assert.equal(r.state.heat, 25);
});

test('a clean getaway does nothing', () => {
  const s = pending('crew');
  s.cash = 1000;
  const r = resolveEncounter(s, 'flee', () => 0, T0);
  assert.equal(r.state.cash, 1000);
  assert.equal(r.state.heat, 0);
  assert.equal(r.state.encounter, null);
});

test('flee odds use the type base plus the fleeChance perk', () => {
  const s = pending('crew');
  assert.ok(Math.abs(fleeOdds(s) - 0.5) < 1e-9);
  s.skills = { warfare3: 2 };
  assert.ok(Math.abs(fleeOdds(s) - 0.58) < 1e-9);
});

test('paying off costs a share of the stake; payCut makes it cheaper', () => {
  const s = pending('crew');
  const cost = Math.round(s.encounter.stake * 0.5);
  assert.equal(payCost(s), cost);
  s.cash = cost - 1;
  assert.equal(resolveEncounter(s, 'pay', () => 0, T0).reason, 'cash');
  s.cash = cost;
  const r = resolveEncounter(s, 'pay', () => 0, T0);
  assert.equal(r.state.cash, 0);
  assert.equal(r.state.encounter, null);
  s.skills = { brains3m: 2 };
  assert.equal(payCost(s), Math.round(s.encounter.stake * 0.5 * 0.8));
});

test('gangLoot raises the cash from a won encounter', () => {
  const s = pending('crew');
  s.skills = { warfare4: 1 };
  assert.equal(resolveEncounter(s, 'fight', () => 0, T0).state.cash, Math.round(s.encounter.stake * 1.1));
});

test('nothing to resolve, or an unknown choice, is refused', () => {
  assert.equal(resolveEncounter(thief(), 'fight', () => 0, T0).reason, 'none');
  assert.equal(resolveEncounter(pending('mugger'), 'dance', () => 0, T0).reason, 'choice');
});

test('an encounter never takes more than twice the stake in cash', () => {
  const s = pending('crew');
  s.cash = 10_000_000;
  const r = resolveEncounter(s, 'fight', () => 0.999, T0);
  assert.equal(r.state.cash, 10_000_000 - Math.round(s.encounter.stake * ENCOUNTER_LOSS_CAP));
});

test('an undercover cop seizes at most twice the stake too', () => {
  const s = pending('cop');
  s.cash = 10_000_000;
  const r = resolveEncounter(s, 'fight', () => 0.999, T0);
  assert.equal(r.state.cash, 10_000_000 - Math.round(s.encounter.stake * ENCOUNTER_LOSS_CAP));
});
