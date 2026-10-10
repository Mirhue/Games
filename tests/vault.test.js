import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { upgradeVault, deposit, withdraw, tick } from '../js/engine.js';
import { VAULTS } from '../js/data.js';

const T0 = 1_000_000;
const HOUR = 3_600_000;
const withVault = (tier, cash = 0, balance = 0) => {
  const s = newState(T0);
  s.vault = { tier, balance };
  s.cash = cash;
  return s;
};
const feeTier = VAULTS.findIndex((v, i) => i > 0 && v.fee > 0);
const interestTier = VAULTS.findIndex((v, i) => i > 0 && v.interestPerHour > 0);

test('there are 5 vault tiers after "none", each bigger than the last', () => {
  assert.equal(VAULTS.length, 6);
  for (let i = 2; i < VAULTS.length; i++) assert.ok(VAULTS[i].capacity > VAULTS[i - 1].capacity);
});

test('upgrading goes one tier at a time and costs cash', () => {
  const s = newState(T0);
  s.cash = VAULTS[1].price - 1;
  assert.equal(upgradeVault(s, T0).reason, 'cash');
  s.cash = VAULTS[1].price;
  const r = upgradeVault(s, T0);
  assert.equal(r.ok, true);
  assert.equal(r.state.vault.tier, 1);
  assert.equal(r.state.cash, 0);
  const top = withVault(VAULTS.length - 1, 1e15);
  assert.equal(upgradeVault(top, T0).reason, 'max');
});

test('depositing without a vault is refused', () => {
  assert.equal(deposit(withVault(0, 100), 50, T0).reason, 'novault');
});

test('deposits are limited by the cash you have', () => {
  const r = deposit(withVault(1, 100), 500, T0);
  assert.equal(r.state.cash, 0);
  assert.equal(r.state.vault.balance, 100);
});

test('deposits are limited by free space', () => {
  const cap = VAULTS[1].capacity;
  const r = deposit(withVault(1, cap * 2, cap - 10), cap * 2, T0);
  assert.equal(r.state.vault.balance, cap);
  assert.equal(r.state.cash, cap * 2 - 10);
});

test('a full vault refuses deposits', () => {
  const cap = VAULTS[1].capacity;
  assert.equal(deposit(withVault(1, 100, cap), 100, T0).reason, 'full');
});

test('deposit fees are taken from the deposit', () => {
  const fee = VAULTS[feeTier].fee;
  const r = deposit(withVault(feeTier, 10_000), 10_000, T0);
  assert.equal(r.state.cash, 0);
  assert.equal(r.state.vault.balance, Math.floor(10_000 * (1 - fee)));
});

test('withdrawals are free and limited to the balance', () => {
  const r = withdraw(withVault(feeTier, 0, 5000), 9000, T0);
  assert.equal(r.state.cash, 5000);
  assert.equal(r.state.vault.balance, 0);
  assert.equal(withdraw(withVault(1), 10, T0).reason, 'empty');
});

test('non-positive amounts are refused', () => {
  assert.equal(deposit(withVault(1, 100), 0, T0).ok, false);
  assert.equal(withdraw(withVault(1, 0, 100), -5, T0).ok, false);
});

test('interest accrues over time but never above capacity', () => {
  const v = VAULTS[interestTier];
  const s = withVault(interestTier, 0, 100_000);
  const after = tick(s, T0 + HOUR);
  assert.ok(Math.abs(after.vault.balance - 100_000 * (1 + v.interestPerHour)) < 1);
  const full = withVault(interestTier, 0, v.capacity - 1);
  assert.equal(tick(full, T0 + 10 * HOUR).vault.balance, v.capacity);
});

test('every paid vault earns its deposit fee back within an hour', () => {
  for (const v of VAULTS.slice(1)) {
    if (v.fee === 0) continue;
    assert.ok(v.interestPerHour > 0, `${v.name} charges a fee but pays no interest`);
    assert.ok(v.fee / v.interestPerHour <= 1, `${v.name}: ${(v.fee / v.interestPerHour).toFixed(1)} h to break even`);
  }
});
