import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { attackRival, resolveRaid, activeRaider, checkWin, tick, applyOffline, rivalState, power, defense } from '../js/engine.js';
import { RIVALS, RANKS, ATTACK_NERVE, GODFATHER, RAID_MIN_MS, RAID_MAX_MS } from '../js/data.js';

const T0 = 1_000_000;
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const top = () => { const s = newState(T0); s.respect = RANKS.at(-1).respect; return s; };
const weakest = RIVALS[0];

test('there are 3 rival gangs, each stronger than the last', () => {
  assert.equal(RIVALS.length, 3);
  assert.ok(RIVALS[1].power > RIVALS[0].power && RIVALS[2].power > RIVALS[1].power);
});

test('a rival above your rank cannot be attacked', () => {
  assert.equal(attackRival(newState(T0), weakest.id, () => 0, T0).reason, 'locked');
});

test('attacking needs nerve and freedom', () => {
  const s = top();
  s.nerve = ATTACK_NERVE - 1;
  assert.equal(attackRival(s, weakest.id, () => 0, T0).reason, 'nerve');
  s.nerve = 100;
  s.jailUntil = T0 + 1000;
  assert.equal(attackRival(s, weakest.id, () => 0, T0).reason, 'jail');
});

test('a won fight damages the rival and pays loot and respect', () => {
  const s = top();
  const r = attackRival(s, weakest.id, () => 0, T0);
  assert.equal(r.won, true);
  assert.equal(rivalState(r.state, weakest.id).hp, weakest.hp - 1);
  assert.equal(r.state.cash, weakest.loot[0]);
  assert.equal(r.state.respect, s.respect + weakest.respect);
  assert.equal(r.state.nerve, s.nerve - ATTACK_NERVE);
});

test('a rival at 0 hp is defeated for good with a big respect bonus', () => {
  const s = top();
  s.rivals[weakest.id] = { hp: 1, defeated: false };
  const r = attackRival(s, weakest.id, () => 0, T0);
  assert.equal(rivalState(r.state, weakest.id).defeated, true);
  assert.equal(r.state.respect, s.respect + weakest.respect + weakest.defeatRespect);
  assert.equal(attackRival(r.state, weakest.id, () => 0, T0).reason, 'defeated');
});

test('a lost fight costs cash on hand and adds heat', () => {
  const s = top();
  s.cash = 1000;
  const r = attackRival(s, weakest.id, () => 0.999, T0);
  assert.equal(r.won, false);
  assert.ok(r.state.cash < 1000);
  assert.ok(r.state.heat > 0);
});

test('fight odds follow power: you / (you + them)', () => {
  const s = top();
  // A roll just under the odds wins, just over loses.
  const odds = power(s) / (power(s) + weakest.power);
  assert.equal(attackRival(s, weakest.id, () => odds - 0.001, T0).won, true);
  assert.equal(attackRival(s, weakest.id, () => odds + 0.001, T0).won, false);
});

test('the strongest undefeated unlocked rival is the raider', () => {
  const s = top();
  assert.equal(activeRaider(s).id, RIVALS[2].id);
  s.rivals[RIVALS[2].id] = { hp: 0, defeated: true };
  assert.equal(activeRaider(s).id, RIVALS[1].id);
  assert.equal(activeRaider(newState(T0)), null);
});

test('a lost raid takes 10-30% of cash on hand but never the vault', () => {
  const s = top();
  s.cash = 10_000;
  s.vault = { tier: 1, balance: 900 };
  const r = resolveRaid(s, seq(0.999, 0.5), T0);   // defense fails, 20% stolen
  assert.equal(r.state.cash, 8000);
  assert.equal(r.state.vault.balance, 900);
  assert.equal(r.state.stats.raidsSuffered, 1);
  assert.ok(r.state.raidIn >= RAID_MIN_MS && r.state.raidIn <= RAID_MAX_MS);
});

test('a repelled raid gives respect', () => {
  const s = top();
  s.cash = 10_000;
  const r = resolveRaid(s, () => 0, T0);
  assert.equal(r.state.cash, 10_000);
  assert.ok(r.state.respect > s.respect);
  assert.equal(r.state.stats.raidsRepelled, 1);
});

test('raid odds follow defense: def / (def + rival power)', () => {
  const s = top();
  s.cash = 100;
  const odds = defense(s) / (defense(s) + activeRaider(s).power);
  assert.equal(resolveRaid(s, () => odds - 0.001, T0).repelled, true);
});

test('the raid timer only runs during play, outside jail, while a raider exists', () => {
  const s = top();
  s.raidIn = 10_000;
  assert.equal(tick(s, T0 + 4000).raidIn, 6000);
  s.jailUntil = T0 + 100_000;
  assert.equal(tick(s, T0 + 4000).raidIn, 10_000);
  const n = newState(T0);
  n.raidIn = 10_000;
  assert.equal(tick(n, T0 + 4000).raidIn, 10_000);
});

test('no raids once every rival is defeated', () => {
  const s = top();
  for (const r of RIVALS) s.rivals[r.id] = { hp: 0, defeated: true };
  s.cash = 1000;
  const r = resolveRaid(s, () => 0.999, T0);
  assert.equal(r.state.cash, 1000);
});

test('coming back after a long break runs one raid check on cash on hand', () => {
  const s = top();
  s.cash = 10_000;
  const { state, summary } = applyOffline(s, T0 + 3_600_000, seq(0.999, 0.5));
  assert.equal(summary.raid, 'lost');
  assert.equal(state.cash, 8000);
});

test('Godfather needs all rivals beaten, enough respect and enough wealth', () => {
  const s = newState(T0);
  s.respect = GODFATHER.respect;
  s.cash = GODFATHER.netWorth;
  assert.equal(checkWin(s, T0).state.won, false);
  for (const r of RIVALS) s.rivals[r.id] = { hp: 0, defeated: true };
  const w = checkWin(s, T0);
  assert.equal(w.state.won, true);
  assert.ok(w.events.length === 1);
  s.cash = GODFATHER.netWorth - 1;
  assert.equal(checkWin(s, T0).state.won, false);
});
