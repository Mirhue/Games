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

test('a v1 save keeps its weapons as one copy each', () => {
  const m = migrate({ version: 1, weapons: { pistol: true, knife: true } });
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.weapons, { pistol: 1, knife: 1 });
});

test('a v1 save gets every skill point back to re-spend in the new tree', () => {
  // v1 node costs by position in a branch: 5, 20, 60, 180, 500.
  const m = migrate({ version: 1, sp: 7, skills: { stealth1: true, stealth2: true, muscle1: true, brains5: true } });
  assert.deepEqual(m.skills, {});
  assert.equal(m.sp, 7 + 5 + 20 + 5 + 500);
});

test('migrating a v2 save changes nothing', () => {
  const s = newState(5);
  s.skills = { stealth1: 3 };
  s.weapons = { knife: 4 };
  assert.deepEqual(migrate(structuredClone(s)), s);
  assert.equal(SAVE_VERSION, 2);
});

test('absurd counts and levels in a damaged save are clamped', async () => {
  const { netWorth } = await import('../js/engine.js');
  const m = migrate({ version: 2, weapons: { knuckles: 3e7, knife: 2.7, pistol: -4 }, investments: { hustle: 1e9 }, skills: { stealth1: 99, street3: 2 } });
  assert.equal(m.weapons.knuckles, 1000);
  assert.equal(m.weapons.knife, 2);
  assert.equal(m.weapons.pistol, undefined);
  assert.equal(m.investments.hustle, 1000);
  assert.equal(m.skills.stealth1, 5);
  assert.equal(m.skills.street3, 2);
  const t = Date.now();
  assert.ok(Number.isFinite(netWorth(m)));
  assert.ok(Date.now() - t < 100, 'netWorth stays fast');
});
