import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, migrate } from '../js/state.js';
import { marketTick, buyMetal, sellMetal, metalBuyPrice, metalSellPrice, metalValue, maxBars, netWorth, resolveRaid, doMission, applyOffline } from '../js/engine.js';
import { METALS, MARKET, RANKS } from '../js/data.js';
import { mulberry32 } from '../js/rng.js';

const T0 = 1_000_000;
const DAY = 24 * 3_600_000;
const metal = (id) => METALS.find((m) => m.id === id);
const rich = () => { const s = newState(T0); s.cash = 1e12; s.respect = RANKS.at(-1).respect; return s; };

test('four metals with rising fair values', () => {
  assert.deepEqual(METALS.map((m) => m.id), ['silver', 'gold', 'platinum', 'palladium']);
  for (let i = 1; i < METALS.length; i++) assert.ok(METALS[i].fair > METALS[i - 1].fair);
});

test('a new game and an old save without a market start at fair prices', () => {
  for (const s of [newState(T0), migrate({ version: 2, createdAt: T0 })]) {
    for (const m of METALS) assert.equal(s.market.prices[m.id], m.fair);
    assert.deepEqual(s.metals, {});
  }
});

test('a damaged market price is repaired on load', () => {
  const s = migrate({ version: 2, market: { prices: { gold: -5, silver: 'x' }, history: {}, news: [], lastStep: 0 } });
  assert.equal(s.market.prices.gold, metal('gold').fair);
  assert.equal(s.market.prices.silver, metal('silver').fair);
});

test('buying pays the price plus the spread and adds bars', () => {
  const s = rich();
  const r = buyMetal(s, 'gold', 3, T0);
  const cost = Math.round(3 * metalBuyPrice(s, 'gold'));
  assert.equal(r.ok, true);
  assert.equal(metalBuyPrice(s, 'gold'), metal('gold').fair * (1 + MARKET.spread));
  assert.equal(r.state.cash, s.cash - cost);
  assert.equal(r.state.metals.gold, 3);
  assert.equal(r.state.metalCost.gold, cost);
});

test('bad buys are refused and change nothing', () => {
  const s = rich();
  for (const q of [0, -1, 1.5, NaN]) assert.equal(buyMetal(s, 'gold', q, T0).reason, 'amount', String(q));
  const poor = newState(T0);
  poor.cash = 10;
  assert.equal(buyMetal(poor, 'silver', 1, T0).reason, 'cash');
  assert.equal(buyMetal(newState(T0), 'palladium', 1, T0).reason, 'locked');
  assert.equal(buyMetal(s, 'unobtainium', 1, T0).reason, 'unknown');
});

test('maxBars is what your cash on hand can buy', () => {
  const s = newState(T0);
  s.cash = 1600;
  assert.equal(maxBars(s, 'silver'), Math.floor(1600 / metalBuyPrice(s, 'silver')));
});

test('selling pays the price minus the spread and keeps the cost basis proportional', () => {
  let s = buyMetal(rich(), 'gold', 4, T0).state;
  const basis = s.metalCost.gold;
  const r = sellMetal(s, 'gold', 1, T0);
  assert.equal(r.state.cash, s.cash + Math.round(metalSellPrice(s, 'gold')));
  assert.equal(r.state.metals.gold, 3);
  assert.ok(Math.abs(r.state.metalCost.gold - basis * 0.75) < 1);
  assert.equal(sellMetal(r.state, 'gold', 4, T0).reason, 'bars');
  s = sellMetal(r.state, 'gold', 3, T0).state;
  assert.equal(s.metals.gold, undefined);
  assert.equal(s.metalCost.gold, undefined);
});

test('buying and selling straight away loses the spread', () => {
  const s = rich();
  const after = sellMetal(buyMetal(s, 'silver', 100, T0).state, 'silver', 100, T0).state;
  const lost = (s.cash - after.cash) / (100 * metal('silver').fair);
  assert.ok(Math.abs(lost - 2 * MARKET.spread) < 0.001);
});

test('the market advances in whole steps and keeps 2 hours of history', () => {
  const s = newState(T0);
  const t = marketTick(s, T0 + MARKET.stepMs * 3.5, mulberry32(1));
  assert.equal(t.market.lastStep, T0 + MARKET.stepMs * 3);
  assert.equal(t.market.history.gold.length, 4);
  const long = marketTick(s, T0 + MARKET.stepMs * 500, mulberry32(1));
  assert.equal(long.market.history.gold.length, MARKET.historyLen);
  assert.equal(marketTick(s, T0 + 10, mulberry32(1)), s, 'no full step: unchanged');
  assert.equal(marketTick(s, T0 - 99_999, mulberry32(1)), s, 'clock went back: unchanged');
});

test('over 20 days prices stay positive and wander around their fair value', () => {
  let s = newState(T0);
  const rng = mulberry32(42);
  const sums = Object.fromEntries(METALS.map((m) => [m.id, 0]));
  let n = 0;
  let headlines = 0;
  for (let h = 1; h <= 20 * 24; h++) {
    s = marketTick(s, T0 + h * 3_600_000, rng);
    for (const m of METALS) {
      const p = s.market.prices[m.id];
      assert.ok(Number.isFinite(p) && p > 0, `${m.id} price ${p}`);
      sums[m.id] += Math.log(p / m.fair);
    }
    n += 1;
  }
  headlines = s.log.filter((e) => e.kind === 'news').length;
  for (const m of METALS) assert.ok(Math.abs(sums[m.id] / n) < 0.12, `${m.id} mean log deviation ${(sums[m.id] / n).toFixed(3)}`);
  assert.ok(headlines > 0, 'some news happened');
});

test('random trading loses money on average', () => {
  let s = newState(T0);
  const rng = mulberry32(7);
  let ret = 0;
  let trades = 0;
  for (let i = 0; i < 400; i++) {
    const m = METALS[i % METALS.length];
    const buy = metalBuyPrice(s, m.id);
    s = marketTick(s, s.market.lastStep + MARKET.stepMs * (1 + Math.floor(rng() * 180)), rng);
    ret += metalSellPrice(s, m.id) / buy - 1;
    trades += 1;
  }
  assert.ok(ret / trades < 0, `average return ${(ret / trades * 100).toFixed(2)}%`);
});

test('a 30-day absence re-draws prices quickly instead of replaying every minute', () => {
  const s = newState(T0);
  const t0 = Date.now();
  const t = marketTick(s, T0 + 30 * DAY, mulberry32(3));
  assert.ok(Date.now() - t0 < 100);
  assert.equal(t.market.history.gold.length, 1);
  assert.deepEqual(t.market.news, []);
  assert.notEqual(t.market.prices.gold, metal('gold').fair);
});

test('prices keep moving while you are away', () => {
  const s = newState(T0);
  const { state } = applyOffline(s, T0 + 3 * 3_600_000, mulberry32(5));
  assert.notEqual(state.market.prices.gold, s.market.prices.gold);
});

test('metals are safe from raids and arrests', () => {
  let s = buyMetal(rich(), 'gold', 5, T0).state;
  s.cash = 10_000;
  const raided = resolveRaid(s, () => 0.999, T0).state;
  assert.ok(raided.cash < 10_000);
  assert.equal(raided.metals.gold, 5);
  const busted = doMission(s, 'turf', ((xs) => { let i = 0; return () => xs[i++ % 2]; })([0.999, 0]), T0);
  assert.equal(busted.arrested, true);
  assert.equal(busted.state.metals.gold, 5);
});

test('net worth counts metals at their selling price, so a crash makes you poorer', () => {
  let s = buyMetal(rich(), 'platinum', 10, T0).state;
  s.cash = 0;
  assert.equal(netWorth(s), Math.round(metalValue(s)));
  assert.equal(metalValue(s), 10 * metalSellPrice(s, 'platinum'));
  const before = netWorth(s);
  s.market.prices.platinum *= 0.5;
  assert.ok(netWorth(s) < before);
});

// A disciplined dip-buyer (buy under 85% of fair value, sell over 110%) may
// make some money, but less per hour than the bank account pays.
test('buying dips and selling booms earns less per hour than bank interest', async () => {
  const { VAULTS } = await import('../js/data.js');
  const bank = VAULTS.find((v) => v.name === 'Bank account').interestPerHour;
  for (const m of METALS) {
    let s = rich();
    s.cash = 10 * m.fair;
    const start = s.cash;
    const rng = mulberry32(11);
    const HOURS = 15 * 24;
    for (let t = 1; t <= HOURS * 60; t++) {
      s = marketTick(s, T0 + t * MARKET.stepMs, rng);
      const r = s.market.prices[m.id] / m.fair;
      const owned = s.metals[m.id] ?? 0;
      if (owned && r > 1.1) s = sellMetal(s, m.id, owned, T0).state;
      else if (!owned && r < 0.85 && maxBars(s, m.id) > 0) s = buyMetal(s, m.id, maxBars(s, m.id), T0).state;
    }
    const end = s.cash + metalValue(s);
    const perHour = (end / start) ** (1 / HOURS) - 1;
    assert.ok(perHour < bank, `${m.id}: ${(perHour * 100).toFixed(2)}% per hour vs bank ${(bank * 100).toFixed(1)}%`);
  }
});

test('you can only hold so many bars of each metal', () => {
  const s = rich();
  const m = METALS[0];
  assert.ok(m.maxBars > 0);
  const r = buyMetal(s, m.id, m.maxBars + 1, T0);
  assert.equal(r.reason, 'limit');
  const full = buyMetal(s, m.id, m.maxBars, T0).state;
  assert.equal(buyMetal(full, m.id, 1, T0).reason, 'limit');
  assert.equal(maxBars(full, m.id), 0);
});

test('a news headline makes the price jump at once', () => {
  let s = newState(T0);
  // Force a headline on the first step: news roll 0, metal pick 0 (silver), direction up.
  const script = [0, 0, 0, 0, 0, 0.5, 0.5, 0.5];
  let i = 0;
  const rng = () => (i < script.length ? script[i++] : 0.5);
  s = marketTick(s, T0 + MARKET.stepMs, rng);
  assert.equal(s.market.news.length, 1);
  assert.ok(s.market.prices.silver > METALS[0].fair * Math.exp(MARKET.newsJump[0] - 0.05), `silver ${s.market.prices.silver}`);
});

test('coming back after hours away logs only the headlines still running', () => {
  let s = newState(T0);
  s = marketTick(s, T0 + 23 * 3_600_000, mulberry32(9));
  const news = s.log.filter((e) => e.kind === 'news');
  assert.ok(news.length <= s.market.news.length, `${news.length} headlines logged, ${s.market.news.length} still running`);
});

test('a damaged market in a save is repaired: unknown news, empty history, bad bar counts', () => {
  const s = migrate({ version: 2, market: { prices: {}, history: { gold: [] , silver: [1, 'x', -3] }, news: [{ metal: 'unobtainium', until: 9e15, text: 'x' }, null], lastStep: 0 },
    metals: { gold: 'lots', silver: 3.7 }, metalCost: { gold: 'x' }, mastery: { bike: -4, mugging: 'x', pickpocket: 12 } });
  assert.deepEqual(s.market.news, []);
  assert.ok(s.market.history.gold.length >= 1);
  assert.ok(s.market.history.silver.every((p) => Number.isFinite(p) && p > 0));
  assert.deepEqual(s.metals, { silver: 3 });
  assert.deepEqual(s.metalCost, {});
  assert.deepEqual(s.mastery, { pickpocket: 12 });
});

test('metals survive a lost gang fight', async () => {
  const { attackRival } = await import('../js/engine.js');
  const s = buyMetal(rich(), 'gold', 5, T0).state;
  const r = attackRival(s, 'rats', () => 0.999, T0);
  assert.equal(r.won, false);
  assert.equal(r.state.metals.gold, 5);
});

test('a metal price spike can make you Godfather', async () => {
  const { tick } = await import('../js/engine.js');
  const { RIVALS, GODFATHER } = await import('../js/data.js');
  let s = rich();
  for (const g of RIVALS) s.rivals[g.id] = { hp: 0, defeated: true };
  s.respect = GODFATHER.respect;
  s = buyMetal(s, 'palladium', 60, T0).state;
  s.cash = 0;
  assert.equal(tick(s, T0 + 1000).won, false);
  s.market.prices.palladium = GODFATHER.netWorth;   // a wild spike
  assert.equal(tick(s, T0 + 1000).won, true);
});
