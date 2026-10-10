import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState } from '../js/state.js';
import { buyWeapon, bestWeapon, power, defense, weaponBonus, successChance } from '../js/engine.js';
import { WEAPONS, MISSIONS, RANKS, BASE_POWER } from '../js/data.js';

const T0 = 1_000_000;
const mission = (id) => MISSIONS.find((m) => m.id === id);
const loaded = () => { const s = newState(T0); s.cash = 1e12; s.respect = RANKS.at(-1).respect; return s; };

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
  const locked = WEAPONS.find((w) => w.rank > 0);
  assert.equal(buyWeapon(s, locked.id, T0).reason, 'locked');
});

test('a weapon needs enough cash and is bought once', () => {
  const s = newState(T0);
  const w = WEAPONS[0];
  s.cash = w.price - 1;
  assert.equal(buyWeapon(s, w.id, T0).reason, 'cash');
  s.cash = w.price;
  const r = buyWeapon(s, w.id, T0);
  assert.equal(r.ok, true);
  assert.equal(r.state.cash, 0);
  assert.equal(buyWeapon(r.state, w.id, T0).reason, 'owned');
});

test('only the best owned weapon counts toward power and defense', () => {
  let s = loaded();
  assert.equal(bestWeapon(s), null);
  assert.equal(power(s), BASE_POWER);
  s = buyWeapon(s, WEAPONS[2].id, T0).state;
  s = buyWeapon(s, WEAPONS[0].id, T0).state;
  assert.equal(bestWeapon(s).id, WEAPONS[2].id);
  assert.equal(power(s), BASE_POWER + WEAPONS[2].power);
  assert.equal(defense(s), BASE_POWER + WEAPONS[2].power);
});

test('the weapon bonus helps muscle jobs only and is capped at 20%', () => {
  let s = loaded();
  const muscle = mission('snatch');
  const stealth = mission('pickpocket');
  const before = [successChance(s, muscle), successChance(s, stealth)];
  s = buyWeapon(s, WEAPONS[0].id, T0).state;
  assert.ok(successChance(s, muscle) > before[0]);
  assert.equal(successChance(s, stealth), before[1]);
  for (const w of WEAPONS) s = buyWeapon(s, w.id, T0).state;
  assert.ok(weaponBonus(s) <= 0.2);
});
