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
  s.skills.stealth1 = true;
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
