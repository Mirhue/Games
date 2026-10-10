import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { investmentPrice, buyInvestment, incomePerMin, tick, applyOffline, netWorth, heatDecayRate, inJail } from '../js/engine.js';
import { INVESTMENTS, OFFLINE_CAP_MS, RANKS, SKILLS, HEAT_DECAY_MS } from '../js/data.js';

const T0 = 1_000_000;
const MIN = 60_000;
const first = INVESTMENTS[0];
const owning = (counts) => { const s = newState(T0); s.investments = counts; s.respect = RANKS.at(-1).respect; return s; };

test('there are 6 investment tiers', () => {
  assert.equal(INVESTMENTS.length, 6);
});

test('each copy costs 15% more than the last', () => {
  const s = owning({});
  assert.equal(investmentPrice(s, first.id), first.basePrice);
  s.investments[first.id] = 2;
  assert.equal(investmentPrice(s, first.id), Math.round(first.basePrice * 1.15 ** 2));
});

test('buying needs rank and cash, and raises the count', () => {
  const s = newState(T0);
  const locked = INVESTMENTS.find((i) => i.rank > 0);
  s.cash = 1e12;
  assert.equal(buyInvestment(s, locked.id, T0).reason, 'locked');
  s.cash = first.basePrice - 1;
  assert.equal(buyInvestment(s, first.id, T0).reason, 'cash');
  s.cash = first.basePrice;
  const r = buyInvestment(s, first.id, T0);
  assert.equal(r.state.investments[first.id], 1);
  assert.equal(r.state.cash, 0);
});

test('income adds up across copies and the brains income bonus', () => {
  const s = owning({ [INVESTMENTS[0].id]: 3, [INVESTMENTS[1].id]: 1 });
  const base = 3 * INVESTMENTS[0].incomePerMin + INVESTMENTS[1].incomePerMin;
  assert.equal(incomePerMin(s), base);
  s.skills.brains1 = true;
  const bonus = SKILLS.find((k) => k.id === 'brains1').effects.incomeBonus;
  assert.ok(Math.abs(incomePerMin(s) - base * (1 + bonus)) < 1e-9);
});

test('tick pays income into cash as whole dollars', () => {
  const s = owning({ [first.id]: 1 });
  let t = s;
  for (let i = 1; i <= 60; i++) t = tick(t, T0 + i * 1000);
  assert.equal(t.cash, first.incomePerMin);
  assert.ok(Number.isInteger(t.cash));
});

test('businesses that launder money speed up heat decay', () => {
  const launder = INVESTMENTS.find((i) => i.heatDecay > 0);
  const s = owning({ [launder.id]: 2 });
  assert.ok(heatDecayRate(s) > 1);
  s.heat = 50;
  const plain = owning({});
  plain.heat = 50;
  assert.ok(tick(s, T0 + 10 * HEAT_DECAY_MS).heat < tick(plain, T0 + 10 * HEAT_DECAY_MS).heat);
});

test('offline income is capped at 2 hours but nerve, heat and jail use the full time', () => {
  const s = owning({ [first.id]: 1 });
  s.respect = 0;   // no rival can raid a street rat
  s.nerve = 0;
  s.heat = 80;
  s.jailUntil = T0 + 60_000;
  const DAYS30 = 30 * 24 * 60 * MIN;
  const { state, summary } = applyOffline(s, T0 + DAYS30, () => 0.5);
  assert.equal(state.cash, first.incomePerMin * (OFFLINE_CAP_MS / MIN));
  assert.equal(summary.income, state.cash);
  assert.equal(summary.elapsed, DAYS30);
  assert.equal(state.nerve, 100);
  assert.equal(state.heat, 0);
  assert.ok(!inJail(state, T0 + DAYS30));
});

test('offline with a backwards clock changes nothing', () => {
  const s = owning({ [first.id]: 1 });
  const { state, summary } = applyOffline(s, T0 - 50_000, () => 0.5);
  assert.equal(state.cash, 0);
  assert.equal(summary.elapsed, 0);
});

test('net worth includes what your businesses cost', () => {
  const s = owning({ [first.id]: 2 });
  s.cash = 10;
  assert.equal(netWorth(s), 10 + first.basePrice + Math.round(first.basePrice * 1.15));
});

test('a short absence is not worth a welcome-back popup, a long one is', () => {
  const s = owning({ [first.id]: 1 });
  s.respect = 0;
  assert.equal(applyOffline(s, T0 + 90_000, () => 0.5).summary.notable, false);
  assert.equal(applyOffline(s, T0 + 10 * MIN, () => 0.5).summary.notable, true);
});

test('a raid while away is always worth showing', () => {
  const s = owning({});
  s.cash = 1000;
  const { summary } = applyOffline(s, T0 + 6 * MIN, () => 0.999);
  assert.equal(summary.raid, 'lost');
  assert.equal(summary.notable, true);
});
