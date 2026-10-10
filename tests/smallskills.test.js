import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import {
  buySkill, skillLevel, skillUnlocked, perk, doMission, bribeCost, applyOffline, power, defense,
  incomePerMin,
} from '../js/engine.js';
import { SKILLS, SKILL_BRANCHES, PERK_CAPS, MISSIONS, JAIL_MS_PER_TIER, OFFLINE_CAP_MS, BASE_POWER, WEAPONS, RANKS, INVESTMENTS } from '../js/data.js';

const T0 = 1_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const byId = (id) => SKILLS.find((k) => k.id === id);
const rich = () => { const s = newState(T0); s.sp = 1e9; return s; };
const NEW_KEYS = ['critChance', 'jailCut', 'fightOdds', 'raidOdds', 'raidLoss', 'gangLoot', 'fleeChance', 'payCut', 'bribeDiscount', 'offlineMin'];

test('43 skills in 5 branches, with a Warfare branch', () => {
  assert.equal(SKILLS.length, 43);
  assert.deepEqual(SKILL_BRANCHES.map((b) => b.id), ['stealth', 'muscle', 'brains', 'street', 'warfare']);
  assert.deepEqual(SKILLS.filter((k) => k.branch === 'warfare' && !k.minor).map((k) => k.name),
    ['Scrapper', 'Lookouts', 'Quick Feet', 'Spoils of War', 'Warlord']);
  assert.equal(new Set(SKILLS.map((k) => k.id)).size, SKILLS.length);
});

test('minor nodes sit between big nodes, max level 3, cheaper than the next big node', () => {
  const minors = SKILLS.filter((k) => k.minor);
  assert.equal(minors.length, 19);
  for (const m of minors) {
    assert.equal(m.maxLevel, 3, m.id);
    const next = SKILLS.find((k) => k.branch === m.branch && !k.minor && k.idx > m.idx);
    if (next) assert.ok(m.baseCost < next.baseCost, `${m.id} costs less than ${next.id}`);
  }
});

test('each node needs the node before it in the chain, minors included', () => {
  let s = rich();
  assert.equal(buySkill(s, 'stealth1m', T0).reason, 'order');
  s = buySkill(s, 'stealth1', T0).state;
  assert.equal(buySkill(s, 'stealth2', T0).reason, 'order');
  s = buySkill(s, 'stealth1m', T0).state;
  assert.equal(buySkill(s, 'stealth2', T0).ok, true);
});

test('a node owned from an older save stays upgradable without the new minor before it', () => {
  const s = rich();
  s.skills = { stealth1: 1, stealth2: 1 };
  assert.equal(skillUnlocked(s, byId('stealth2')), true);
  assert.equal(skillLevel(buySkill(s, 'stealth2', T0).state, 'stealth2'), 2);
  assert.equal(buySkill(s, 'stealth1m', T0).ok, true);
});

test('every new perk key has a cap that holds', () => {
  for (const key of NEW_KEYS) {
    assert.ok(PERK_CAPS[key] > 0, `${key} has a cap`);
    const s = newState(T0);
    for (const k of SKILLS) if (k.effects[key]) s.skills[k.id] = 1000;
    assert.equal(perk(s, key), PERK_CAPS[key], key);
  }
  assert.equal(PERK_CAPS.offlineMin, 120);
  assert.equal(PERK_CAPS.critChance, 0.1);
});

test('a critical job pays double cash', () => {
  const s = newState(T0);
  s.skills = { stealth3m: 3 };
  const m = MISSIONS.find((x) => x.id === 'pickpocket');
  // success, cash roll 0, crit roll under the chance
  const r = doMission(s, m.id, seq(0, 0, 0), T0);
  assert.equal(r.state.cash, m.cash[0] * 2);
  assert.ok(r.events.some((e) => /double/i.test(e.text)));
  const miss = doMission(s, m.id, seq(0, 0, 0.99), T0);
  assert.equal(miss.state.cash, m.cash[0]);
});

test('jailCut shortens jail time', () => {
  const s = newState(T0);
  s.skills = { stealth2m: 3 };
  const m = MISSIONS.find((x) => x.id === 'pickpocket');
  const r = doMission(s, m.id, seq(0.99, 0), T0);
  assert.equal(r.arrested, true);
  assert.equal(r.state.jailUntil, T0 + Math.round(JAIL_MS_PER_TIER * (1 - 3 * byId('stealth2m').effects.jailCut)));
});

test('bribeDiscount makes bribes cheaper', () => {
  const s = newState(T0);
  s.heat = 50;
  const full = bribeCost(s);
  s.skills = { brains2m: 2 };
  assert.equal(bribeCost(s), Math.round(full * (1 - 2 * byId('brains2m').effects.bribeDiscount)));
});

test('offlineMin extends offline income', () => {
  const s = newState(T0);
  s.investments = { hustle: 1 };
  s.skills = { brains1m: 3 };
  const extra = 3 * byId('brains1m').effects.offlineMin * 60_000;
  const away = applyOffline(s, T0 + 10 * 3_600_000, () => 0.99);
  assert.equal(away.summary.income, Math.round(incomePerMin(s) * (OFFLINE_CAP_MS + extra) / 60_000));
});

test('Warlord scales power and defense', () => {
  const s = newState(T0);
  s.respect = RANKS.at(-1).respect;
  s.weapons = { knuckles: 2 };
  const before = [power(s), defense(s)];
  s.skills = { warfare5: 1 };
  assert.equal(power(s), Math.round(before[0] * 1.25));
  assert.equal(defense(s), Math.round(before[1] * 1.25));
});
