import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { buyWeapon, bestWeapon, weaponCount, weaponPrice, power, defense, weaponBonus, successChance, effect, perk, nerveMax, nerveRegenMs } from '../js/engine.js';
import { WEAPONS, WEAPON_GROWTH, MISSIONS, RANKS, BASE_POWER, PERK_CAPS, NERVE_MAX_BASE, NERVE_REGEN_MS } from '../js/data.js';

const T0 = 1_000_000;
const mission = (id) => MISSIONS.find((m) => m.id === id);
const weapon = (id) => WEAPONS.find((w) => w.id === id);
const loaded = () => { const s = newState(T0); s.cash = 1e15; s.respect = RANKS.at(-1).respect; return s; };
const arm = (s, id, n) => { for (let i = 0; i < n; i++) { const r = buyWeapon(s, id, T0); assert.equal(r.ok, true, r.reason); s = r.state; } return s; };

test('there are 7 weapon tiers with rising price and power', () => {
  assert.equal(WEAPONS.length, 7);
  for (let i = 1; i < WEAPONS.length; i++) {
    assert.ok(WEAPONS[i].price > WEAPONS[i - 1].price);
    assert.ok(WEAPONS[i].power > WEAPONS[i - 1].power);
  }
});

test('a weapon above your rank is refused', () => {
  const s = newState(T0);
  s.cash = 1e12;
  assert.equal(buyWeapon(s, WEAPONS.find((w) => w.rank > 0).id, T0).reason, 'locked');
});

test('weapons can be bought again, each copy costing 25% more', () => {
  let s = loaded();
  const w = WEAPONS[0];
  assert.equal(weaponPrice(s, w.id), w.price);
  s = arm(s, w.id, 3);
  assert.equal(weaponCount(s, w.id), 3);
  assert.equal(weaponPrice(s, w.id), Math.round(w.price * WEAPON_GROWTH ** 3));
  assert.equal(s.cash, 1e15 - [0, 1, 2].reduce((a, n) => a + Math.round(w.price * WEAPON_GROWTH ** n), 0));
});

test('a copy needs enough cash', () => {
  const s = newState(T0);
  s.cash = WEAPONS[0].price - 1;
  assert.equal(buyWeapon(s, WEAPONS[0].id, T0).reason, 'cash');
});

test('power and defense add up across every copy of every weapon', () => {
  let s = loaded();
  assert.equal(power(s), BASE_POWER);
  s = arm(s, WEAPONS[0].id, 3);
  s = arm(s, WEAPONS[2].id, 2);
  const expected = BASE_POWER + 3 * WEAPONS[0].power + 2 * WEAPONS[2].power;
  assert.equal(power(s), expected);
  assert.equal(defense(s), expected);
});

test('the muscle-job bonus comes from the best weapon type only', () => {
  let s = loaded();
  s = arm(s, WEAPONS[0].id, 10);
  assert.equal(weaponBonus(s), WEAPONS[0].bonus);
  s = arm(s, WEAPONS[1].id, 1);
  assert.equal(bestWeapon(s).id, WEAPONS[1].id);
  assert.equal(weaponBonus(s), WEAPONS[1].bonus);
  assert.ok(successChance(s, mission('snatch')) > successChance(newState(T0), mission('snatch')));
  assert.equal(successChance(s, mission('pickpocket')), successChance(newState(T0), mission('pickpocket')));
});

test('quiet weapons cut job heat per copy', () => {
  const s = arm(loaded(), 'pistol', 2);
  assert.ok(Math.abs(effect(s, 'heatReduction') - 2 * weapon('pistol').perks.heatReduction) < 1e-9);
});

test('shotguns raise max nerve per copy, up to the cap', () => {
  let s = arm(loaded(), 'shotgun', 2);
  assert.equal(nerveMax(s), NERVE_MAX_BASE + 2 * weapon('shotgun').perks.nerveMax);
  s.weapons.shotgun = 1000;
  assert.equal(nerveMax(s), NERVE_MAX_BASE + PERK_CAPS.nerveMax);
});

test('a hundred tommy guns still only double nerve regeneration', () => {
  const s = loaded();
  s.weapons.smg = 100;
  assert.equal(perk(s, 'nerveRegen'), PERK_CAPS.nerveRegen);
  assert.equal(nerveRegenMs(s), NERVE_REGEN_MS / 2);
});
