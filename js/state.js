import { SAVE_VERSION, NERVE_MAX_BASE, RAID_MIN_MS, SKILLS, METALS } from './data.js';
import { freshMarket } from './market.js';

export const SAVE_KEY = 'kingpin.save';

export function newState(now) {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastTick: now,
    cash: 0,
    respect: 0,
    sp: 0,
    nerve: NERVE_MAX_BASE,
    heat: 0,
    jailUntil: 0,
    skills: {},
    weapons: {},
    vault: { tier: 0, balance: 0 },
    investments: {},
    mastery: {},             // successful runs per job
    metals: {},              // bars owned per metal
    metalCost: {},           // dollars paid for the bars still owned
    market: freshMarket(now),
    rivals: {},
    raidIn: RAID_MIN_MS,     // ms of play until the next raid
    incomePot: 0,
    stats: { missions: 0, successes: 0, arrests: 0, raidsSuffered: 0, raidsRepelled: 0, earned: 0, playMs: 0 },
    won: false,
    log: [],
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(str) {
  if (!str) return null;
  let obj;
  try {
    obj = JSON.parse(str);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  return migrate(obj);
}

// No real player gets near this many copies of a weapon or business.
const MAX_COUNT = 1000;

// What each skill node cost in v1, by its position in the branch.
const V1_SKILL_COSTS = [5, 20, 60, 180, 500];

const isObject = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Fill in anything a save from an older version is missing, and replace
// fields of the wrong type so a damaged save can't crash the game later.
export function migrate(obj) {
  const base = newState(Number.isFinite(obj.createdAt) ? obj.createdAt : 0);
  const out = { ...base, ...obj, version: SAVE_VERSION };
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === 'number' && !Number.isFinite(out[key])) out[key] = value;
    if (isObject(value) && !isObject(out[key])) out[key] = value;
    if (Array.isArray(value) && !Array.isArray(out[key])) out[key] = value;
  }
  // v1 → v2: the skill tree was redesigned with levels, so v1 skills are
  // reset and every skill point spent on them is refunded to re-spend.
  if ((obj.version ?? 1) < 2) {
    for (const id of Object.keys(out.skills)) {
      const idx = Number(id.slice(-1));
      out.sp += V1_SKILL_COSTS[idx - 1] ?? 0;
    }
    out.skills = {};
  }
  // v1 stored owned weapons as `true`; v2 stores levels and counts. Counts
  // are whole numbers up to MAX_COUNT and skill levels stop at their max,
  // so a damaged save can't make every net-worth calculation crawl.
  for (const key of ['skills', 'weapons', 'investments']) {
    for (const [id, v] of Object.entries(out[key])) {
      const n = v === true ? 1 : Math.floor(v);
      const max = key === 'skills' ? (SKILLS.find((k) => k.id === id)?.maxLevel ?? 0) : MAX_COUNT;
      if (!Number.isFinite(n) || n < 1 || max < 1) delete out[key][id];
      else out[key][id] = Math.min(n, max);
    }
  }
  // Repair any missing or broken metal price and its history.
  for (const m of METALS) {
    const p = out.market.prices?.[m.id];
    if (!out.market.prices || typeof out.market.prices !== 'object') out.market.prices = {};
    if (!Number.isFinite(p) || p <= 0) out.market.prices[m.id] = m.fair;
    if (!out.market.history || typeof out.market.history !== 'object') out.market.history = {};
    if (!Array.isArray(out.market.history[m.id])) out.market.history[m.id] = [out.market.prices[m.id]];
  }
  if (!Array.isArray(out.market.news)) out.market.news = [];
  if (!Number.isFinite(out.market.lastStep)) out.market.lastStep = out.lastTick;
  for (const key of ['vault', 'stats']) {
    out[key] = { ...base[key], ...out[key] };
    for (const [k, v] of Object.entries(base[key])) {
      if (!Number.isFinite(out[key][k])) out[key][k] = v;
    }
  }
  return out;
}
