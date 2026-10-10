import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, serialize, deserialize, migrate } from '../js/state.js';
import { SAVE_VERSION, NERVE_MAX_BASE } from '../js/data.js';

test('newState starts a broke street rat with full nerve', () => {
  const s = newState(1000);
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.cash, 0);
  assert.equal(s.nerve, NERVE_MAX_BASE);
  assert.equal(s.heat, 0);
  assert.equal(s.lastTick, 1000);
  assert.deepEqual(s.vault, { tier: 0, balance: 0 });
});

test('serialize/deserialize round-trips the state', () => {
  const s = newState(1000);
  s.cash = 1234;
  s.skills.stealth1 = 2;
  assert.deepEqual(deserialize(serialize(s)), s);
});

test('deserialize returns null for corrupt data', () => {
  assert.equal(deserialize('{not json'), null);
  assert.equal(deserialize(''), null);
  assert.equal(deserialize(null), null);
  assert.equal(deserialize('42'), null);
});

test('migrate fills missing fields from a fresh state', () => {
  const m = migrate({ version: 1, cash: 5 });
  assert.equal(m.cash, 5);
  assert.equal(m.nerve, NERVE_MAX_BASE);
  assert.deepEqual(m.stats, newState(0).stats);
  assert.deepEqual(m.vault, { tier: 0, balance: 0 });
});

test('migrate repairs wrong-typed fields instead of crashing later', () => {
  const m = migrate({ version: 1, skills: null, weapons: 'x', investments: [], rivals: 5, log: 'oops', cash: null, nerve: 'NaN' });
  assert.deepEqual(m.skills, {});
  assert.deepEqual(m.weapons, {});
  assert.deepEqual(m.investments, {});
  assert.deepEqual(m.rivals, {});
  assert.deepEqual(m.log, []);
  assert.equal(m.cash, 0);
  assert.equal(m.nerve, NERVE_MAX_BASE);
});

test('a repaired save can be ticked and played', async () => {
  const { tick, applyOffline } = await import('../js/engine.js');
  const m = deserialize(JSON.stringify({ version: 1, skills: null, investments: null, rivals: null, log: 'oops', lastTick: 0 }));
  assert.doesNotThrow(() => tick(applyOffline(m, 600_000, () => 0.5).state, 601_000));
});

test('a v1 save with true flags migrates to levels and counts', () => {
  const m = migrate({ version: 1, skills: { stealth1: true, muscle2: true }, weapons: { pistol: true } });
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.skills, { stealth1: 1, muscle2: 1 });
  assert.deepEqual(m.weapons, { pistol: 1 });
});

test('migrating a v2 save changes nothing', () => {
  const s = newState(5);
  s.skills = { stealth1: 3 };
  s.weapons = { knife: 4 };
  assert.deepEqual(migrate(structuredClone(s)), s);
  assert.equal(SAVE_VERSION, 2);
});
