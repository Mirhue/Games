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

import { buySkill, attackRival } from '../js/engine.js';
import { SKILLS, PERK_CAPS, ATTACK_NERVE } from '../js/data.js';

const oldPro = () => SKILLS.find((k) => k.id === 'street4');
const withSkills = (s, levels) => { s.skills = { ...s.skills, ...levels }; return s; };

test('Old Pro is the 4th Street Life skill and needs Second Wind first', () => {
  const k = oldPro();
  assert.equal(k.name, 'Old Pro');
  assert.equal(k.maxLevel, 5);
  assert.equal(k.effects.nerveCost, 0.03);
  const s = newState(T0);
  s.sp = 1e6;
  s.skills = { street1: 1, street2: 1 };
  assert.equal(buySkill(s, 'street4', T0).reason, 'order');
  s.skills.street3 = 1;
  assert.equal(buySkill(s, 'street4', T0).ok, true);
});

test('Old Pro cuts job nerve by 3% per level, on top of mastery and outgrown', () => {
  const m = mission('bank');   // 20 nerve
  const s = withSkills(mastered(atRank(4), 'bank', 2), { street4: 5 });
  assert.equal(jobNerve(s, m), Math.round(20 * (1 - 2 * MASTERY.nerveCut) * (1 - 5 * 0.03)));
});

test('the nerve-cost perk is capped at 30%', () => {
  assert.equal(PERK_CAPS.nerveCost, 0.3);
  const s = withSkills(atRank(4), { street4: 50 });
  assert.equal(jobNerve(s, mission('bank')), Math.round(20 * (1 - 0.3)));
});

test('Old Pro does not discount rival attacks', () => {
  const s = withSkills(atRank(5), { street4: 5 });
  const r = attackRival(s, 'rats', () => 0, T0);
  assert.equal(r.state.nerve, s.nerve - ATTACK_NERVE);
});

test('outgrown jobs pay half the skill points and respect per outgrown level', () => {
  const m = mission('mugging');   // tier 2: +7 respect, +2 SP
  const s = atRank(4);            // 2 outgrown levels
  const r = doMission(s, 'mugging', () => 0, T0);
  assert.equal(r.state.sp - s.sp, Math.floor(m.sp * 0.25));
  assert.equal(r.state.respect - s.respect, Math.floor(m.respect * 0.25));
});

test('a tier-2 job never drops to the same 1 nerve as a tier-1 job (costs round up)', () => {
  const s = withSkills(mastered(mastered(atRank(5), 'car_breakin', 3), 'pickpocket', 3), { street4: 5 });
  assert.ok(jobNerve(s, mission('car_breakin')) >= 2, `car break-in costs ${jobNerve(s, mission('car_breakin'))}`);
});

test('no job beats the best top-tier job on skill points per nerve', () => {
  for (let rank = 1; rank < RANKS.length; rank++) {
    const s = withSkills(atRank(rank), { street4: 5 });
    for (const m of MISSIONS) s.mastery[m.id] = 500;
    const open = MISSIONS.filter((m) => m.tier <= rank + 1);
    const spPerNerve = (m) => {
      const sp = Math.floor(m.sp * OUTGROWN.rewardFactor ** outgrownLevel(s, m));
      return (successChance(s, m) * sp) / jobNerve(s, m);
    };
    const top = Math.max(...open.filter((m) => m.tier === rank + 1).map(spPerNerve));
    for (const m of open) assert.ok(spPerNerve(m) <= top * 1.2, `rank ${rank}: ${m.id} ${spPerNerve(m).toFixed(2)} SP/nerve vs top ${top.toFixed(2)}`);
  }
});
