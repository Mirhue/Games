import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { doMission, masteryLevel, outgrownLevel, jobNerve, successChance, nerveMax } from '../js/engine.js';
import { MISSIONS, RANKS, MASTERY, OUTGROWN } from '../js/data.js';

const T0 = 1_000_000;
const mission = (id) => MISSIONS.find((m) => m.id === id);
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const atRank = (r) => { const s = newState(T0); s.respect = RANKS[r].respect; return s; };
const mastered = (s, id, level) => { s.mastery[id] = MASTERY.levels[level].at; return s; };

test('mastery levels are reached at 10, 40 and 120 successes', () => {
  assert.deepEqual(MASTERY.levels.map((l) => l.at), [0, 10, 40, 120]);
  const s = newState(T0);
  assert.equal(masteryLevel(s, 'bike'), 0);
  s.mastery.bike = 9;
  assert.equal(masteryLevel(s, 'bike'), 0);
  s.mastery.bike = 10;
  assert.equal(masteryLevel(s, 'bike'), 1);
  s.mastery.bike = 500;
  assert.equal(masteryLevel(s, 'bike'), 3);
});

test('a successful job counts toward its mastery, a failed one does not', () => {
  const s = newState(T0);
  assert.equal(doMission(s, 'bike', () => 0, T0).state.mastery.bike, 1);
  assert.equal(doMission(s, 'bike', () => 0.999, T0).state.mastery.bike, undefined);
});

test('reaching a mastery level is announced', () => {
  const s = newState(T0);
  s.mastery.bike = 9;
  const r = doMission(s, 'bike', () => 0, T0);
  assert.ok(r.events.some((e) => /Skilled/.test(e.text)));
});

test('mastery cuts nerve cost by 10% per level and adds 3% success per level', () => {
  const m = mission('bank');   // 20 nerve
  const s = atRank(4);
  const before = successChance(s, m);
  mastered(s, 'bank', 2);
  assert.equal(jobNerve(s, m), Math.round(20 * (1 - 2 * MASTERY.nerveCut)));
  assert.ok(Math.abs(successChance(s, m) - (before + 2 * MASTERY.chance)) < 1e-9);
});

test('jobs two or more tiers below your top tier are outgrown, up to 3 levels', () => {
  const t1 = mission('pickpocket');
  assert.equal(outgrownLevel(atRank(0), t1), 0);
  assert.equal(outgrownLevel(atRank(1), t1), 0);   // top tier 2: one tier below
  assert.equal(outgrownLevel(atRank(2), t1), 1);
  assert.equal(outgrownLevel(atRank(5), t1), OUTGROWN.max);
  assert.equal(outgrownLevel(atRank(5), mission('bank')), 0);
});

test('outgrown jobs cost less nerve, succeed more and give half the heat per level', () => {
  const m = mission('burglary');   // tier 2, 8 nerve
  const fresh = atRank(1);
  const old = atRank(4);           // top tier 5: burglary is 2 outgrown levels
  assert.equal(outgrownLevel(old, m), 2);
  assert.equal(jobNerve(old, m), Math.round(8 * (1 - 2 * OUTGROWN.nerveCut)));
  assert.ok(Math.abs(successChance(old, m) - Math.min(0.95, successChance(fresh, m) + 2 * OUTGROWN.chance)) < 1e-9);
  assert.equal(doMission(old, 'burglary', () => 0, T0).state.heat, m.heat * OUTGROWN.heatFactor ** 2);
});

test('discounts multiply but a job always costs at least 1 nerve', () => {
  const s = mastered(atRank(5), 'pickpocket', 3);
  assert.equal(jobNerve(s, mission('pickpocket')), 1);
  const r = doMission(s, 'pickpocket', () => 0.5, T0);
  assert.equal(r.state.nerve, s.nerve - 1 + (r.refunded ? 1 : 0));
});

test('a job costs its discounted nerve and is allowed with just that much', () => {
  const s = mastered(atRank(4), 'bank', 3);
  s.nerve = jobNerve(s, mission('bank'));
  const r = doMission(s, 'bank', () => 0.999, T0);
  assert.equal(r.ok, true);
  assert.equal(r.state.nerve, 0);
});

test('a mastered job sometimes gives its nerve back on success', () => {
  const s = mastered(atRank(4), 'bank', 3);
  s.nerve = 50;
  const cost = jobNerve(s, mission('bank'));
  // rolls: success, payout, refund
  const lucky = doMission(s, 'bank', seq(0, 0, MASTERY.refundChance - 0.01), T0);
  assert.equal(lucky.refunded, true);
  assert.equal(lucky.state.nerve, 50);
  const unlucky = doMission(s, 'bank', seq(0, 0, MASTERY.refundChance + 0.01), T0);
  assert.equal(unlucky.refunded, false);
  assert.equal(unlucky.state.nerve, 50 - cost);
});

test('only Master jobs refund nerve, and never above max nerve', () => {
  const s = mastered(atRank(4), 'bank', 2);
  s.nerve = 50;
  assert.equal(doMission(s, 'bank', () => 0, T0).refunded, false);
  const full = mastered(atRank(4), 'bank', 3);
  full.nerve = nerveMax(full);
  assert.ok(doMission(full, 'bank', () => 0, T0).state.nerve <= nerveMax(full));
});

test('on average no job gives back as much nerve as it costs', () => {
  assert.ok(MASTERY.refundChance < 1);
});
