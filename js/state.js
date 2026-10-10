import { SAVE_VERSION, NERVE_MAX_BASE, RAID_MIN_MS } from './data.js';

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
  // v1 stored owned skills and weapons as `true`; v2 stores levels and counts.
  for (const key of ['skills', 'weapons']) {
    for (const [id, v] of Object.entries(out[key])) {
      if (v === true) out[key][id] = 1;
      else if (!Number.isFinite(v) || v < 1) delete out[key][id];
    }
  }
  for (const key of ['vault', 'stats']) {
    out[key] = { ...base[key], ...out[key] };
    for (const [k, v] of Object.entries(base[key])) {
      if (!Number.isFinite(out[key][k])) out[key][k] = v;
    }
  }
  return out;
}
