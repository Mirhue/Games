// Pure game rules. Every action takes the state (plus rng/now where needed),
// works on a copy and returns { ok, state, events, reason? }.
import { NERVE_MAX_BASE, NERVE_REGEN_MS, RANKS, MISSIONS } from './data.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const clone = (s) => structuredClone(s);
const good = (text) => ({ kind: 'good', text });
const bad = (text) => ({ kind: 'bad', text });
const info = (text) => ({ kind: 'info', text });
const refuse = (state, reason, text) => ({ ok: false, state, reason, events: [info(text)] });
export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function rankIndex(state) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (state.respect >= r.respect) idx = i; });
  return idx;
}

export function rankName(state) {
  return state.won ? 'Godfather' : RANKS[rankIndex(state)].name;
}

export function nerveMax(state) {
  return NERVE_MAX_BASE;
}

export function successChance(state, mission) {
  return clamp(mission.baseChance, 0.05, 0.95);
}

export function addLog(state, events, now) {
  for (const e of events) state.log.unshift({ t: now, ...e });
  state.log.length = Math.min(state.log.length, 50);
}

// Gives respect, cash and sp to a working copy and reports promotions.
function reward(s, { cash = 0, respect = 0, sp = 0 }, events) {
  const before = rankIndex(s);
  s.cash = Math.round(s.cash + cash);
  s.respect += respect;
  s.sp += sp;
  if (cash > 0) s.stats.earned += Math.round(cash);
  const after = rankIndex(s);
  if (after > before) events.push(good(`You've been promoted to ${RANKS[after].name}! New jobs are available.`));
}

export function doMission(state, missionId, rng, now) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return refuse(state, 'unknown', 'Unknown job.');
  if (m.tier > rankIndex(state) + 1) return refuse(state, 'locked', `You need to be a ${RANKS[m.tier - 1].name} for that.`);
  if (state.nerve < m.nerve) return refuse(state, 'nerve', 'Not enough nerve. Catch your breath.');

  const s = clone(state);
  const events = [];
  s.nerve -= m.nerve;
  s.stats.missions += 1;
  const success = rng() < successChance(s, m);
  if (success) {
    const cash = Math.round(m.cash[0] + rng() * (m.cash[1] - m.cash[0]));
    s.stats.successes += 1;
    events.push(good(`${m.name}: success! +${money(cash)}, +${m.respect} respect, +${m.sp} SP.`));
    reward(s, { cash, respect: m.respect, sp: m.sp }, events);
  } else {
    events.push(bad(`${m.name}: it went wrong. You got away empty-handed.`));
  }
  addLog(s, events, now);
  return { ok: true, success, state: s, events };
}

// Advances time-based systems. Returns a new state.
export function tick(state, now) {
  const elapsed = now - state.lastTick;
  if (elapsed <= 0) return state;
  const s = clone(state);
  s.lastTick = now;
  s.nerve = Math.min(nerveMax(s), s.nerve + elapsed / NERVE_REGEN_MS);
  return s;
}
