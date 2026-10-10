// Metals market rules. Pure: rng and now are passed in. Prices follow a
// mean-reverting random walk around each metal's fair value, plus news.
import { METALS, MARKET } from './data.js';
import { rankIndex, addLog, money } from './engine.js';

const metal = (id) => METALS.find((m) => m.id === id);
const refuse = (state, reason, text) => ({ ok: false, state, reason, events: [{ kind: 'info', text }] });
const THETA = Math.LN2 / MARKET.halfLifeMs;           // reversion speed per ms
const KEEP = Math.exp(-THETA * MARKET.stepMs);         // share of deviation kept per step
const SHOCK = Math.sqrt(1 - KEEP * KEEP);              // keeps the swing size stationary

export function freshMarket(now) {
  return {
    prices: Object.fromEntries(METALS.map((m) => [m.id, m.fair])),
    history: Object.fromEntries(METALS.map((m) => [m.id, [m.fair]])),
    news: [],
    lastStep: now,
  };
}

// Standard normal from two uniform numbers (Box–Muller).
function normal(rng) {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const between = (rng, [lo, hi]) => lo + rng() * (hi - lo);

function maybeNews(s, t, rng, events) {
  s.market.news = s.market.news.filter((n) => n.until > t);
  if (rng() >= MARKET.newsPerStep) return;
  const quiet = METALS.filter((m) => !s.market.news.some((n) => n.metal === m.id));
  if (!quiet.length) return;
  const m = quiet[Math.floor(rng() * quiet.length)];
  const up = rng() < 0.5;
  const list = MARKET.headlines[up ? 'up' : 'down'];
  const text = list[Math.floor(rng() * list.length)].replace('{metal}', m.name.toLowerCase());
  const shift = (up ? 1 : -1) * between(rng, MARKET.newsShift);
  s.market.news.push({ metal: m.id, shift, until: t + between(rng, MARKET.newsMs), text });
  events.push({ kind: 'news', text: `Market news: ${text}` });
}

// Advances the market by whole one-minute steps up to `now`.
export function marketTick(state, now, rng) {
  const steps = Math.floor((now - state.market.lastStep) / MARKET.stepMs);
  if (steps <= 0) return state;
  const s = structuredClone(state);
  const events = [];
  const end = s.market.lastStep + steps * MARKET.stepMs;
  if (end - s.market.lastStep > MARKET.redrawAfterMs) {
    // After a long absence the past no longer matters: draw fresh prices.
    for (const m of METALS) {
      const p = m.fair * Math.exp(m.vol * normal(rng));
      s.market.prices[m.id] = p;
      s.market.history[m.id] = [p];
    }
    s.market.news = [];
  } else {
    for (let i = 1; i <= steps; i++) {
      const t = s.market.lastStep + i * MARKET.stepMs;
      maybeNews(s, t, rng, events);
      for (const m of METALS) {
        const target = s.market.news.find((n) => n.metal === m.id)?.shift ?? 0;
        const x = Math.log(s.market.prices[m.id] / m.fair);
        const next = target + (x - target) * KEEP + m.vol * SHOCK * normal(rng);
        const p = m.fair * Math.exp(next);
        s.market.prices[m.id] = p;
        const h = s.market.history[m.id];
        h.push(p);
        if (h.length > MARKET.historyLen) h.splice(0, h.length - MARKET.historyLen);
      }
    }
  }
  s.market.lastStep = end;
  addLog(s, events, now);
  return s;
}

export const metalBuyPrice = (state, id) => state.market.prices[id] * (1 + MARKET.spread);
export const metalSellPrice = (state, id) => state.market.prices[id] * (1 - MARKET.spread);
export const maxBars = (state, id) => Math.max(0, Math.floor(state.cash / metalBuyPrice(state, id)));

export function metalValue(state) {
  let total = 0;
  for (const m of METALS) total += (state.metals[m.id] ?? 0) * metalSellPrice(state, m.id);
  return total;
}

export function buyMetal(state, id, qty, now) {
  const m = metal(id);
  if (!m) return refuse(state, 'unknown', 'Unknown metal.');
  if (!Number.isInteger(qty) || qty < 1) return refuse(state, 'amount', 'Pick how many bars to buy.');
  if (m.rank > rankIndex(state)) return refuse(state, 'locked', `The ${m.name.toLowerCase()} dealers don't know you yet.`);
  const cost = Math.round(qty * metalBuyPrice(state, id));
  if (state.cash < cost) return refuse(state, 'cash', `${qty} bar${qty > 1 ? 's' : ''} of ${m.name.toLowerCase()} cost ${money(cost)}.`);
  const s = structuredClone(state);
  s.cash -= cost;
  s.metals[id] = (s.metals[id] ?? 0) + qty;
  s.metalCost[id] = (s.metalCost[id] ?? 0) + cost;
  const events = [{ kind: 'info', text: `Bought ${qty} bar${qty > 1 ? 's' : ''} of ${m.name.toLowerCase()} for ${money(cost)}.` }];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function sellMetal(state, id, qty, now) {
  const m = metal(id);
  if (!m) return refuse(state, 'unknown', 'Unknown metal.');
  if (!Number.isInteger(qty) || qty < 1) return refuse(state, 'amount', 'Pick how many bars to sell.');
  const owned = state.metals[id] ?? 0;
  if (qty > owned) return refuse(state, 'bars', `You only have ${owned} bar${owned === 1 ? '' : 's'} of ${m.name.toLowerCase()}.`);
  const proceeds = Math.round(qty * metalSellPrice(state, id));
  const s = structuredClone(state);
  s.cash += proceeds;
  const basis = (s.metalCost[id] ?? 0) * (qty / owned);
  if (qty === owned) {
    delete s.metals[id];
    delete s.metalCost[id];
  } else {
    s.metals[id] = owned - qty;
    s.metalCost[id] -= basis;
  }
  const result = proceeds - basis;
  const events = [{ kind: result >= 0 ? 'good' : 'bad', text: `Sold ${qty} bar${qty > 1 ? 's' : ''} of ${m.name.toLowerCase()} for ${money(proceeds)} (${result >= 0 ? 'profit' : 'loss'} ${money(Math.abs(result))}).` }];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}
