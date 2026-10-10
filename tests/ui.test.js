import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt } from '../js/ui.js';

test('fmt shows small amounts in full and large ones with a suffix', () => {
  assert.equal(fmt(0), '$0');
  assert.equal(fmt(1234), '$1,234');
  assert.equal(fmt(15_300), '$15.3K');
  assert.equal(fmt(2_500_000), '$2.5M');
  assert.equal(fmt(500_000_000), '$500M');
  assert.equal(fmt(3_000_000_000), '$3B');
});

test('describePerks turns effect objects into readable text', async () => {
  const { describePerks } = await import('../js/ui.js');
  assert.equal(describePerks({ stealthChance: 0.015, heatReduction: 0.02 }), '+1.5% stealth jobs, −2% job heat');
  assert.equal(describePerks({ muscleChance: 0.01, power: 6, defense: 6 }), '+1% muscle jobs, +6 power & defense');
  assert.equal(describePerks({ nerveRegen: 0.06 }), '+6% nerve regen');
  assert.equal(describePerks({}), '');
});

test('every panel and the encounter popup render for a late-game state', async () => {
  const { renderPanel, renderTopbar, encounterModal, TABS } = await import('../js/ui.js');
  const { newState } = await import('../js/state.js');
  const { RANKS, SKILLS } = await import('../js/data.js');
  const s = newState(1000);
  s.respect = RANKS.at(-1).respect;
  s.cash = 1e6;
  s.investments = { hustle: 2, bar: 1 };
  s.sabotage = { bar: 999_999 };
  s.vault = { tier: 3, balance: 5000 };
  s.vaultFrozenUntil = 999_999;
  s.raidFrom = 'triad';
  s.rivals = { rats: { hp: 1, defeated: false, quietMs: 1000, grownMs: 3_600_000 } };
  for (const k of SKILLS) s.skills[k.id] = 1;
  s.encounter = { type: 'cop', tier: 3, stake: 1500, respect: 22, power: 96 };
  for (const [tab] of TABS) assert.ok(renderPanel(s, 2000, { tab, working: null }).length > 100, tab);
  assert.match(renderPanel(s, 2000, { tab: 'rivals', working: null }), /want revenge/);
  assert.match(renderPanel(s, 2000, { tab: 'vault', working: null }), /Vault hacked/);
  assert.match(renderPanel(s, 2000, { tab: 'business', working: null }), /Sabotaged/);
  assert.match(renderTopbar(s, 2000), /Income/);
  const modal = encounterModal(s);
  assert.match(modal, /Undercover cop/);
  assert.equal((modal.match(/data-action="encounter"/g) ?? []).length, 3);
});
