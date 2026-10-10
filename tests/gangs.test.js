import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import {
  attackRival, resolveRaid, tick, applyOffline, rivalState, rivalPower, rivalUnlocked, fightOdds, raidOdds,
  power, defense, incomePerMin, deposit, withdraw, perk,
} from '../js/engine.js';
import { RIVALS, RANKS, GANGS, RAID_MIN_MS } from '../js/data.js';

const T0 = 1_000_000;
const HOUR = 3_600_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const gang = (id) => RIVALS.find((g) => g.id === id);
const top = () => { const s = newState(T0); s.respect = RANKS.at(-1).respect; return s; };
// A state where only `id` can raid: every other gang is defeated
// (the Commission stays locked unless it is the one asked for).
function only(id) {
  const s = top();
  for (const g of RIVALS) if (g.id !== id && g.id !== 'commission') s.rivals[g.id] = { hp: 0, defeated: true };
  if (id !== 'commission') s.rivals.commission = { hp: 0, defeated: true };
  return s;
}
const LOSE = 0.999;   // a roll that fails any repel

test('seven gangs with the spec raid effects', () => {
  assert.deepEqual(RIVALS.map((g) => [g.id, g.raid]), [
    ['rats', 'cash'], ['cuervos', 'heat'], ['riders', 'weapons'], ['triad', 'sabotage'],
    ['ghostnet', 'hack'], ['volkov', 'cash'], ['commission', 'cash'],
  ]);
  for (const g of RIVALS) assert.ok(g.icon && g.boss && g.raidText, g.id);
});

test('the Commission is locked until the other six are defeated', () => {
  const s = top();
  assert.equal(rivalUnlocked(s, gang('commission')), false);
  assert.equal(attackRival(s, 'commission', () => 0, T0).reason, 'locked');
  for (const g of RIVALS.slice(0, 6)) s.rivals[g.id] = { hp: 0, defeated: true };
  assert.equal(rivalUnlocked(s, gang('commission')), true);
  assert.equal(attackRival(s, 'commission', () => 0, T0).ok, true);
});

test('the raider is a random unlocked, undefeated gang', () => {
  const s = top();
  s.cash = 1000;
  const unlocked = RIVALS.filter((g) => rivalUnlocked(s, g));
  assert.equal(unlocked.length, 6);
  const seen = new Set();
  for (let i = 0; i < unlocked.length; i++) {
    const pick = (i + 0.5) / unlocked.length;
    const r = resolveRaid(s, seq(pick, 0), T0);
    seen.add(r.raider);
  }
  assert.equal(seen.size, 6);
});

test('Cuervos tip off the cops: heat instead of cash', () => {
  const s = only('cuervos');
  s.cash = 10_000;
  const r = resolveRaid(s, () => LOSE, T0);
  assert.equal(r.state.cash, 10_000);
  assert.equal(r.state.heat, GANGS.heatRaid);
});

test('Hell\'s Riders steal 10% of your weapon copies, at least one', () => {
  const s = only('riders');
  s.weapons = { knuckles: 15, knife: 5 };
  const r = resolveRaid(s, () => LOSE, T0);
  const left = (r.state.weapons.knuckles ?? 0) + (r.state.weapons.knife ?? 0);
  assert.equal(left, 18);
  const one = only('riders');
  one.weapons = { knuckles: 1 };
  assert.equal(resolveRaid(one, () => LOSE, T0).state.weapons.knuckles ?? 0, 0);
});

test('the Triad shuts down your biggest-earning business type for 10 minutes', () => {
  const s = only('triad');
  s.investments = { hustle: 3, bar: 1 };
  const full = incomePerMin(s, T0);
  const r = resolveRaid(s, () => LOSE, T0);
  assert.equal(r.state.sabotage.bar, T0 + GANGS.sabotageMs);
  assert.ok(incomePerMin(r.state, T0 + 1000) < full);
  assert.equal(incomePerMin(r.state, T0 + 1000), incomePerMin({ ...s, investments: { hustle: 3 } }, T0));
  assert.equal(incomePerMin(r.state, T0 + GANGS.sabotageMs), full);
});

test('a sabotaged business earns nothing during tick', () => {
  const s = only('triad');
  s.investments = { hustle: 1 };
  const r = resolveRaid(s, () => LOSE, T0).state;
  r.lastTick = T0;
  assert.equal(tick(r, T0 + 60_000).cash, s.cash);
});

test('Ghost Net freezes the vault: no deposits, withdrawals or interest', () => {
  const s = only('ghostnet');
  s.cash = 1000;
  s.vault = { tier: 3, balance: 100_000 };
  const r = resolveRaid(s, () => LOSE, T0).state;
  assert.equal(r.vaultFrozenUntil, T0 + GANGS.freezeMs);
  assert.equal(r.vault.balance, 100_000);
  assert.equal(deposit(r, 100, T0 + 1000).reason, 'frozen');
  assert.equal(withdraw(r, 100, T0 + 1000).reason, 'frozen');
  r.lastTick = T0;
  assert.equal(tick(r, T0 + 60_000).vault.balance, 100_000);
  assert.equal(withdraw(r, 100, T0 + GANGS.freezeMs).ok, true);
});

test('a raid with nothing to hit steals cash instead', () => {
  for (const id of ['riders', 'triad', 'ghostnet']) {
    const s = only(id);
    s.cash = 10_000;
    const r = resolveRaid(s, seq(LOSE, 0.5), T0);
    assert.equal(r.state.cash, 8000, id);
  }
});

test('raidLoss softens every raid effect', () => {
  const s = only('cuervos');
  s.skills = { muscle1m: 3, warfare1m: 3 };
  const cut = perk(s, 'raidLoss');
  assert.ok(cut > 0);
  assert.equal(resolveRaid(s, () => LOSE, T0).state.heat, GANGS.heatRaid * (1 - cut));
  const t = only('triad');
  t.skills = s.skills;
  t.investments = { hustle: 1 };
  assert.equal(resolveRaid(t, () => LOSE, T0).state.sabotage.hustle, T0 + Math.round(GANGS.sabotageMs * (1 - cut)));
  const c = only('rats');
  c.skills = s.skills;
  c.cash = 10_000;
  assert.equal(resolveRaid(c, seq(LOSE, 0.5), T0).state.cash, 10_000 - Math.round(2000 * (1 - cut)));
});

test('gangs grow 10% stronger per hour of play, up to +50%', () => {
  let s = only('rats');
  s.lastTick = T0;
  s = tick(s, T0 + HOUR);
  assert.equal(rivalPower(s, gang('rats')), Math.round(gang('rats').power * 1.1));
  s = tick(s, T0 + 10 * HOUR);
  assert.equal(rivalPower(s, gang('rats')), Math.round(gang('rats').power * 1.5));
  assert.ok(fightOdds(s, gang('rats')) < power(s) / (power(s) + gang('rats').power));
  assert.ok(raidOdds(s, gang('rats')) < defense(s) / (defense(s) + gang('rats').power));
});

test('time away does not make gangs grow', () => {
  const s = only('rats');
  const away = applyOffline(s, T0 + 5 * HOUR, () => 0).state;
  assert.equal(rivalPower(away, gang('rats')), gang('rats').power);
});

test('winning a fight resets the growth', () => {
  let s = only('rats');
  s = tick(s, T0 + 2 * HOUR);
  const r = attackRival(s, 'rats', () => 0, T0 + 2 * HOUR).state;
  assert.equal(rivalPower(r, gang('rats')), gang('rats').power);
});

test('a hurt gang heals 1 hp after 20 minutes of play without a fight', () => {
  let s = only('riders');
  s.rivals.riders = { hp: 1, defeated: false };
  s = tick(s, T0 + GANGS.healMs - 1000);
  assert.equal(rivalState(s, 'riders').hp, 1);
  s = tick(s, T0 + GANGS.healMs);
  assert.equal(rivalState(s, 'riders').hp, 2);
  s = tick(s, T0 + 100 * GANGS.healMs);
  assert.equal(rivalState(s, 'riders').hp, gang('riders').hp);
});

test('a fight restarts the healing clock', () => {
  let s = only('riders');
  s.rivals.riders = { hp: 2, defeated: false };
  s = tick(s, T0 + GANGS.healMs - 1000);
  s = attackRival(s, 'riders', () => LOSE, T0 + GANGS.healMs - 1000).state;
  s = tick(s, T0 + GANGS.healMs + 1000);
  assert.equal(rivalState(s, 'riders').hp, 2);
});

test('a gang that survives a fight may retaliate within 1-3 minutes', () => {
  const s = only('rats');
  s.raidIn = RAID_MIN_MS;
  // win roll, loot roll, retaliation roll (under 50%), delay roll
  const r = attackRival(s, 'rats', seq(0, 0, 0.1, 0.5), T0).state;
  assert.equal(r.raidFrom, 'rats');
  assert.equal(r.raidIn, Math.round(GANGS.retaliateMs[0] + 0.5 * (GANGS.retaliateMs[1] - GANGS.retaliateMs[0])));
  const calm = attackRival(s, 'rats', seq(0, 0, 0.9), T0).state;
  assert.equal(calm.raidFrom, null);
  assert.equal(calm.raidIn, RAID_MIN_MS);
});

test('a lost fight can also bring retaliation', () => {
  const s = only('rats');
  const r = attackRival(s, 'rats', seq(LOSE, 0.1, 0), T0).state;
  assert.equal(r.raidFrom, 'rats');
});

test('the retaliating gang makes the next raid, then the mark is cleared', () => {
  const s = top();
  s.cash = 10_000;
  s.raidFrom = 'cuervos';
  const r = resolveRaid(s, () => LOSE, T0);
  assert.equal(r.raider, 'cuervos');
  assert.equal(r.state.heat, GANGS.heatRaid);
  assert.equal(r.state.raidFrom, null);
});

test('time away resolves a pending retaliation raid', () => {
  const s = top();
  s.cash = 10_000;
  s.raidFrom = 'cuervos';
  const { state } = applyOffline(s, T0 + HOUR, () => LOSE);
  assert.equal(state.raidFrom, null);
  assert.ok(state.heat > 0);
});

test('a defeated gang cannot retaliate', () => {
  const s = only('rats');
  s.rivals.rats = { hp: 1, defeated: false };
  const r = attackRival(s, 'rats', seq(0, 0, 0.1, 0.5), T0).state;
  assert.equal(rivalState(r, 'rats').defeated, true);
  assert.equal(r.raidFrom, null);
});

test('gangLoot raises loot and fightOdds/raidOdds raise the odds', () => {
  const s = only('rats');
  const base = attackRival(s, 'rats', seq(0, 0, 0.9), T0).state.cash;
  s.skills = { warfare4: 2 };
  assert.equal(attackRival(s, 'rats', seq(0, 0, 0.9), T0).state.cash, Math.round(base * 1.2));
  const t = only('rats');
  const [f, r] = [fightOdds(t, gang('rats')), raidOdds(t, gang('rats'))];
  t.skills = { warfare1: 2, warfare2: 1 };
  assert.ok(Math.abs(fightOdds(t, gang('rats')) - Math.min(0.95, f + 0.04)) < 1e-9);
  assert.ok(Math.abs(raidOdds(t, gang('rats')) - Math.min(0.95, r + 0.03)) < 1e-9);
});

