import { SAVE_VERSION, NERVE_MAX_BASE } from './data.js';

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
    nextRaidAt: 0,
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

// Fill in anything a save from an older version is missing.
export function migrate(obj) {
  const base = newState(obj.createdAt ?? 0);
  const out = { ...base, ...obj, version: SAVE_VERSION };
  for (const key of ['vault', 'stats']) {
    out[key] = { ...base[key], ...(obj[key] ?? {}) };
  }
  return out;
}
