import { marketTick, metalValue } from './market.js';

export { marketTick, buyMetal, sellMetal, metalBuyPrice, metalSellPrice, metalValue, maxBars } from './market.js';

// Pure game rules. Every action takes the state (plus rng/now where needed),
// works on a copy and returns { ok, state, events, reason? }.
import {
  NERVE_MAX_BASE, NERVE_REGEN_MS, RANKS, MISSIONS, MASTERY, OUTGROWN,
  HEAT_MAX, HEAT_DECAY_MS, HEAT_CHANCE_PENALTY, HEAT_ARREST_BONUS, ARREST_BASE,
  JAIL_MS_PER_TIER, SEIZE_FRACTION, BAIL_MIN, BAIL_NET_WORTH_FRACTION, BRIBE_PER_HEAT, SKILLS, SKILL_GROWTH,
  BASE_POWER, WEAPON_BONUS_CAP, WEAPON_GROWTH, WEAPONS, VAULTS,
  INVESTMENTS, INVESTMENT_GROWTH, PERK_CAPS, OFFLINE_CAP_MS,
  RIVALS, ATTACK_NERVE, FIGHT_LOSS_HEAT, FIGHT_LOSS_CASH, RAID_MIN_MS, RAID_MAX_MS, RAID_STEAL,
  OFFLINE_RAID_AFTER_MS, GODFATHER, GANGS, ENCOUNTERS, ENCOUNTER_CHANCE, ENCOUNTER_POWER,
} from './data.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const clone = (s) => structuredClone(s);
const good = (text) => ({ kind: 'good', text });
const bad = (text) => ({ kind: 'bad', text });
const info = (text) => ({ kind: 'info', text });
const refuse = (state, reason, text) => ({ ok: false, state, reason, events: [info(text)] });
export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

export function rankIndex(state) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (state.respect >= r.respect) idx = i; });
  return idx;
}

export function rankName(state) {
  return state.won ? 'Godfather' : RANKS[rankIndex(state)].name;
}

// Sum of a perk from every source: skill levels, weapon copies, business copies.
export function effect(state, key) {
  let total = 0;
  for (const k of SKILLS) total += (state.skills[k.id] ?? 0) * (k.effects[key] ?? 0);
  for (const w of WEAPONS) total += (state.weapons[w.id] ?? 0) * (w.perks?.[key] ?? 0);
  for (const inv of INVESTMENTS) total += (state.investments[inv.id] ?? 0) * (inv.perks?.[key] ?? 0);
  return total;
}

export const capped = (key, value) => Math.min(PERK_CAPS[key] ?? Infinity, value);

// The perk value the rules use: the sum, limited by its cap.
export const perk = (state, key) => capped(key, effect(state, key));

export function nerveRegenMs(state) {
  return NERVE_REGEN_MS / (1 + perk(state, 'nerveRegen'));
}

export const skillLevel = (state, skillId) => state.skills[skillId] ?? 0;

// SP cost of the next level, or null when the skill is maxed.
export function skillCost(state, skillId) {
  const k = SKILLS.find((x) => x.id === skillId);
  const level = skillLevel(state, skillId);
  if (level >= k.maxLevel) return null;
  return Math.round(k.baseCost * SKILL_GROWTH ** level);
}

// The node right before this one in its branch's chain (big or minor).
function prevSkill(k) {
  let prev = null;
  for (const x of SKILLS) if (x.branch === k.branch && x.idx < k.idx && (!prev || x.idx > prev.idx)) prev = x;
  return prev;
}

// A node unlocks when the node before it is learned. A node you already own
// stays upgradable, even if a newer minor node was put in front of it.
export function skillUnlocked(state, k) {
  const prev = prevSkill(k);
  return !prev || skillLevel(state, prev.id) >= 1 || skillLevel(state, k.id) >= 1;
}

// Learns a skill or raises it by one level.
export function buySkill(state, skillId, now) {
  const k = SKILLS.find((x) => x.id === skillId);
  if (!k) return refuse(state, 'unknown', 'Unknown skill.');
  if (!skillUnlocked(state, k)) return refuse(state, 'order', `Learn ${prevSkill(k).name} first.`);
  const cost = skillCost(state, skillId);
  if (cost === null) return refuse(state, 'max', `${k.name} is already maxed out.`);
  if (state.sp < cost) return refuse(state, 'sp', `You need ${cost} SP.`);
  const s = clone(state);
  s.sp -= cost;
  s.skills[k.id] = skillLevel(state, k.id) + 1;
  const level = s.skills[k.id];
  const events = [good(level === 1 ? `You learned ${k.name}.` : `${k.name} is now level ${level}.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export const weaponCount = (state, weaponId) => state.weapons[weaponId] ?? 0;

export function weaponPrice(state, weaponId) {
  const w = WEAPONS.find((x) => x.id === weaponId);
  return Math.round(w.price * WEAPON_GROWTH ** weaponCount(state, weaponId));
}

// The strongest weapon type you own (it sets the muscle-job bonus).
export function bestWeapon(state) {
  let best = null;
  for (const w of WEAPONS) if (weaponCount(state, w.id) > 0 && (!best || w.power > best.power)) best = w;
  return best;
}

export function weaponBonus(state) {
  return Math.min(WEAPON_BONUS_CAP, bestWeapon(state)?.bonus ?? 0);
}

function crewPower(state) {
  let total = 0;
  for (const w of WEAPONS) total += weaponCount(state, w.id) * w.power;
  return total;
}

export function power(state) {
  return Math.round((BASE_POWER + crewPower(state) + perk(state, 'power')) * (1 + perk(state, 'powerPct')));
}

export function defense(state) {
  return Math.round((BASE_POWER + crewPower(state) + perk(state, 'defense')) * (1 + perk(state, 'powerPct')));
}

// Buys one more copy of a weapon for your crew.
export function buyWeapon(state, weaponId, now) {
  const w = WEAPONS.find((x) => x.id === weaponId);
  if (!w) return refuse(state, 'unknown', 'Unknown weapon.');
  if (w.rank > rankIndex(state)) return refuse(state, 'locked', `Dealers only sell that to a ${RANKS[w.rank].name}.`);
  const price = weaponPrice(state, weaponId);
  if (state.cash < price) return refuse(state, 'cash', `You need ${money(price)} in cash.`);
  const s = clone(state);
  s.cash -= price;
  s.weapons[w.id] = weaponCount(state, w.id) + 1;
  const n = s.weapons[w.id];
  const events = [good(n === 1 ? `You bought a ${w.name}.` : `Another ${w.name} for the crew (×${n}).`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function nerveMax(state) {
  return NERVE_MAX_BASE + perk(state, 'nerveMax');
}

// Mastery level of a job (index into MASTERY.levels), from its success count.
export function masteryLevel(state, jobId) {
  const done = state.mastery[jobId] ?? 0;
  let level = 0;
  MASTERY.levels.forEach((l, i) => { if (done >= l.at) level = i; });
  return level;
}

// How far a job is below your top unlocked tier, past the first tier (0-3).
export function outgrownLevel(state, mission) {
  return clamp(rankIndex(state) - mission.tier, 0, OUTGROWN.max);
}

// The nerve a job costs you now: mastery and outgrown discounts multiply.
export function jobNerve(state, mission) {
  const cut = (1 - MASTERY.nerveCut * masteryLevel(state, mission.id))
    * (1 - OUTGROWN.nerveCut * outgrownLevel(state, mission))
    * (1 - perk(state, 'nerveCost'));
  // Round up (with a little float slack) so a discounted tier-2 job never
  // costs the same single nerve as a tier-1 job.
  return Math.max(1, Math.ceil(mission.nerve * cut - 1e-9));
}

export function successChance(state, mission) {
  const chance = mission.baseChance
    + MASTERY.chance * masteryLevel(state, mission.id)
    + OUTGROWN.chance * outgrownLevel(state, mission)
    + perk(state, `${mission.type}Chance`)
    + (mission.type === 'muscle' ? weaponBonus(state) : 0)
    - state.heat * HEAT_CHANCE_PENALTY;
  return clamp(chance, 0.05, 0.95);
}

export function arrestChance(state, mission) {
  return clamp(ARREST_BASE[mission.tier - 1] + state.heat * HEAT_ARREST_BONUS, 0, 0.95);
}

export function netWorth(state) {
  let businesses = 0;
  for (const inv of INVESTMENTS) {
    for (let n = 0; n < (state.investments[inv.id] ?? 0); n++) businesses += priceOfCopy(inv, n);
  }
  let arsenal = 0;
  for (const w of WEAPONS) {
    for (let n = 0; n < weaponCount(state, w.id); n++) arsenal += Math.round(w.price * WEAPON_GROWTH ** n);
  }
  return Math.round(state.cash + state.vault.balance + businesses + arsenal + metalValue(state));
}

export const inJail = (state, now) => state.jailUntil > now;

const heatGained = (s, amount) => amount * (1 - perk(s, 'heatReduction'));

function addHeat(s, amount) {
  s.heat = clamp(s.heat + amount, 0, HEAT_MAX);
}

export function bailCost(state) {
  const discount = perk(state, 'bailDiscount');
  return Math.round(Math.max(BAIL_MIN, netWorth(state) * BAIL_NET_WORTH_FRACTION) * (1 - discount));
}

export function payBail(state, now) {
  if (!inJail(state, now)) return refuse(state, 'free', "You're not in jail.");
  const cost = bailCost(state);
  if (state.cash < cost) return refuse(state, 'cash', `Bail is ${money(cost)} in cash. You can't cover it.`);
  const s = clone(state);
  s.cash -= cost;
  s.jailUntil = 0;
  const events = [good(`You paid ${money(cost)} bail and walked out.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function bribeCost(state) {
  return Math.round(Math.ceil(state.heat) * BRIBE_PER_HEAT[rankIndex(state)] * (1 - perk(state, 'bribeDiscount')));
}

export const jailMs = (state, tier) => Math.round(JAIL_MS_PER_TIER * tier * (1 - perk(state, 'jailCut')));

export const offlineCapMs = (state) => OFFLINE_CAP_MS + perk(state, 'offlineMin') * 60_000;

export function bribeCops(state, now) {
  if (state.heat < 1) return refuse(state, 'cold', 'The cops are not looking for you.');
  const cost = bribeCost(state);
  if (state.cash < cost) return refuse(state, 'cash', `The cops want ${money(cost)}. You don't have it.`);
  const s = clone(state);
  s.cash -= cost;
  s.heat = 0;
  const events = [good(`You slipped the cops ${money(cost)}. Heat is gone.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function addLog(state, events, now) {
  for (const e of events) state.log.unshift({ t: now, ...e });
  state.log.length = Math.min(state.log.length, 50);
}

// Gives respect, cash and sp to a working copy and reports promotions.
function reward(s, { cash = 0, respect = 0, sp = 0 }, events) {
  const before = rankIndex(s);
  s.cash = Math.round(s.cash + cash);
  s.respect += respect;
  s.sp += sp;
  if (cash > 0) s.stats.earned += Math.round(cash);
  const after = rankIndex(s);
  if (after > before) events.push(good(`You've been promoted to ${RANKS[after].name}! New jobs are available.`));
}

export function doMission(state, missionId, rng, now) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return refuse(state, 'unknown', 'Unknown job.');
  if (m.tier > rankIndex(state) + 1) return refuse(state, 'locked', `You need to be a ${RANKS[m.tier - 1].name} for that.`);
  if (inJail(state, now)) return refuse(state, 'jail', "You're in jail.");
  if (state.encounter) return refuse(state, 'encounter', 'Deal with the trouble in front of you first.');
  const cost = jobNerve(state, m);
  if (state.nerve < cost) return refuse(state, 'nerve', 'Not enough nerve. Catch your breath.');

  const s = clone(state);
  const events = [];
  const og = outgrownLevel(state, m);
  const heatFactor = OUTGROWN.heatFactor ** og;
  const respect = Math.floor(m.respect * OUTGROWN.rewardFactor ** og);
  const sp = Math.floor(m.sp * OUTGROWN.rewardFactor ** og);
  s.nerve -= cost;
  s.stats.missions += 1;
  const success = rng() < successChance(s, m);
  let arrested = false;
  let refunded = false;
  if (success) {
    addHeat(s, heatGained(s, m.heat * heatFactor));
    const base = m.cash[0] + rng() * (m.cash[1] - m.cash[0]);
    let cash = Math.round(base * (1 + perk(s, 'payoutBonus')));
    // Rolled only with the perk, so runs without it keep the same rng sequence.
    const crit = perk(s, 'critChance') > 0 && rng() < perk(s, 'critChance');
    if (crit) cash *= 2;
    s.stats.successes += 1;
    events.push(good(`${m.name}: success! +${money(cash)}, +${respect} respect, +${sp} SP.`));
    if (crit) events.push(good('Lucky break: the take was double!'));
    if (masteryLevel(state, m.id) === MASTERY.levels.length - 1 && rng() < MASTERY.refundChance) {
      refunded = true;
      s.nerve = Math.min(nerveMax(s), s.nerve + cost);
      events.push(good('Smooth job! You got your nerve back.'));
    }
    const before = masteryLevel(s, m.id);
    s.mastery[m.id] = (s.mastery[m.id] ?? 0) + 1;
    const after = masteryLevel(s, m.id);
    if (after > before) events.push(good(`${m.name}: you are now ${MASTERY.levels[after].name}. It costs less nerve and succeeds more often.`));
    reward(s, { cash, respect, sp }, events);
  } else {
    arrested = rng() < arrestChance(s, m);
    addHeat(s, heatGained(s, (m.heat / 2) * heatFactor));
    if (arrested) {
      const seized = Math.round(s.cash * SEIZE_FRACTION);
      s.cash -= seized;
      s.jailUntil = now + jailMs(s, m.tier);
      s.stats.arrests += 1;
      events.push(bad(`${m.name}: busted! The cops seized ${money(seized)} and locked you up for ${Math.round(jailMs(s, m.tier) / 1000)}s.`));
    } else {
      events.push(bad(`${m.name}: it went wrong. You got away empty-handed.`));
    }
  }
  // Trouble on the way back: only after tier 2+ jobs that didn't end in jail.
  if (!arrested && m.tier >= 2 && rng() < ENCOUNTER_CHANCE) {
    const e = ENCOUNTERS[Math.min(ENCOUNTERS.length - 1, Math.floor(rng() * ENCOUNTERS.length))];
    s.encounter = {
      type: e.id, tier: m.tier, stake: (m.cash[0] + m.cash[1]) / 2, respect: m.respect,
      power: Math.round(ENCOUNTER_POWER[m.tier - 1] * e.mult),
    };
    events.push(bad(`Trouble: ${e.text}`));
  }
  winCheck(s, events);
  addLog(s, events, now);
  return { ok: true, success, arrested, refunded, state: s, events };
}

export const encounterType = (state) => ENCOUNTERS.find((e) => e.id === state.encounter?.type) ?? null;

export function encounterOdds(state) {
  const p = power(state);
  return clamp(p / (p + state.encounter.power) + perk(state, 'fightOdds'), 0.05, 0.95);
}

export const fleeOdds = (state) => clamp(encounterType(state).flee + perk(state, 'fleeChance'), 0.05, 0.95);

export const payCost = (state) => Math.round(state.encounter.stake * encounterType(state).pay * (1 - perk(state, 'payCut')));

// What losing an encounter (or failing to flee) does.
function encounterLoss(s, enc, type, now, events) {
  const { lose } = type;
  if (lose.jail) {
    const seized = Math.round(s.cash * SEIZE_FRACTION);
    s.cash -= seized;
    s.jailUntil = now + jailMs(s, enc.tier);
    s.stats.arrests += 1;
    events.push(bad(`The ${type.name.toLowerCase()} cuffed you. The cops seized ${money(seized)} and locked you up for ${Math.round(jailMs(s, enc.tier) / 1000)}s.`));
    return;
  }
  const parts = [];
  if (lose.cashLoss) {
    const lost = Math.round(s.cash * lose.cashLoss);
    s.cash -= lost;
    parts.push(`you lost ${money(lost)}`);
  }
  if (lose.heat) {
    addHeat(s, lose.heat);
    parts.push(`+${lose.heat} heat`);
  }
  events.push(bad(`${type.name}: it went badly, ${parts.join(' and ')}.`));
}

// Answers a pending street encounter: 'fight', 'flee' or 'pay'.
export function resolveEncounter(state, choice, rng, now) {
  const enc = state.encounter;
  const type = encounterType(state);
  if (!enc || !type) return refuse(state, 'none', 'Nobody is bothering you.');
  if (!['fight', 'flee', 'pay'].includes(choice)) return refuse(state, 'choice', 'Fight, flee or pay.');
  if (choice === 'pay' && state.cash < payCost(state)) return refuse(state, 'cash', `They want ${money(payCost(state))} in cash.`);
  const s = clone(state);
  s.encounter = null;
  const events = [];
  let won = false;
  if (choice === 'pay') {
    const cost = payCost(state);
    s.cash -= cost;
    events.push(info(`You paid the ${type.name.toLowerCase()} ${money(cost)} to go away.`));
  } else if (choice === 'flee') {
    if (rng() < fleeOdds(state)) events.push(info(`You slipped away from the ${type.name.toLowerCase()}.`));
    else encounterLoss(s, enc, type, now, events);
  } else {
    won = rng() < encounterOdds(state);
    if (won) {
      const cash = Math.round(enc.stake * (type.win.cash ?? 0) * (1 + perk(s, 'gangLoot')));
      const respect = Math.round(enc.respect * type.win.respect);
      if (type.win.heat) addHeat(s, type.win.heat);
      events.push(good(`You dealt with the ${type.name.toLowerCase()}. ${cash ? `+${money(cash)}, ` : ''}+${respect} respect${type.win.heat ? `, +${type.win.heat} heat` : ''}.`));
      reward(s, { cash, respect }, events);
    } else {
      encounterLoss(s, enc, type, now, events);
    }
  }
  winCheck(s, events);
  addLog(s, events, now);
  return { ok: true, won, state: s, events };
}

export function upgradeVault(state, now) {
  const next = VAULTS[state.vault.tier + 1];
  if (!next) return refuse(state, 'max', 'You already have the best vault money can buy.');
  if (state.cash < next.price) return refuse(state, 'cash', `A ${next.name} costs ${money(next.price)}.`);
  const s = clone(state);
  s.cash -= next.price;
  s.vault.tier += 1;
  const events = [good(`You upgraded to a ${next.name}.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export const vaultFrozen = (state, now) => (state.vaultFrozenUntil ?? 0) > now;
const frozenRefusal = (state) => refuse(state, 'frozen', 'Ghost Net hacked your vault. It is frozen for now.');

export function deposit(state, amount, now) {
  const v = VAULTS[state.vault.tier];
  if (state.vault.tier === 0) return refuse(state, 'novault', 'You need a place to stash your money first.');
  if (vaultFrozen(state, now)) return frozenRefusal(state);
  if (!(amount > 0) || state.cash < 1) return refuse(state, 'amount', 'Nothing to deposit.');
  const space = v.capacity - state.vault.balance;
  if (space < 1) return refuse(state, 'full', `Your ${v.name} is full.`);
  // Pay in cash, the vault receives cash × (1 − fee), never more than the free space.
  const paid = Math.floor(Math.min(amount, state.cash, space / (1 - v.fee)));
  if (paid < 1) return refuse(state, 'amount', 'Nothing to deposit.');
  const credited = Math.min(space, Math.floor(paid * (1 - v.fee)));
  const s = clone(state);
  s.cash -= paid;
  s.vault.balance += credited;
  const fee = paid - credited;
  const events = [info(`Deposited ${money(credited)}${fee > 0 ? ` (fee ${money(fee)})` : ''}.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function withdraw(state, amount, now) {
  if (vaultFrozen(state, now)) return frozenRefusal(state);
  if (!(amount > 0)) return refuse(state, 'amount', 'Nothing to withdraw.');
  if (state.vault.balance < 1) return refuse(state, 'empty', 'Your vault is empty.');
  const taken = Math.floor(Math.min(amount, state.vault.balance));
  const s = clone(state);
  s.vault.balance -= taken;
  s.cash += taken;
  const events = [info(`Withdrew ${money(taken)}.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

function accrueInterest(s, ms) {
  const v = VAULTS[s.vault.tier];
  if (!v.interestPerHour || s.vault.balance <= 0) return;
  const grown = s.vault.balance * (1 + v.interestPerHour * ms / 3_600_000);
  s.vault.balance = Math.min(v.capacity, grown);
}

const priceOfCopy = (inv, n) => Math.round(inv.basePrice * INVESTMENT_GROWTH ** n);

export function investmentPrice(state, invId) {
  const inv = INVESTMENTS.find((x) => x.id === invId);
  return priceOfCopy(inv, state.investments[invId] ?? 0);
}

export function buyInvestment(state, invId, now) {
  const inv = INVESTMENTS.find((x) => x.id === invId);
  if (!inv) return refuse(state, 'unknown', 'Unknown business.');
  if (inv.rank > rankIndex(state)) return refuse(state, 'locked', `Only a ${RANKS[inv.rank].name} can run a ${inv.name}.`);
  const price = investmentPrice(state, invId);
  if (state.cash < price) return refuse(state, 'cash', `You need ${money(price)} in cash.`);
  const s = clone(state);
  s.cash -= price;
  s.investments[invId] = (s.investments[invId] ?? 0) + 1;
  const events = [good(`You bought a ${inv.name} (#${s.investments[invId]}).`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export const sabotaged = (state, invId, now) => (state.sabotage?.[invId] ?? 0) > now;

// Income per minute right now; a business type the Triad sabotaged earns nothing.
export function incomePerMin(state, now = state.lastTick) {
  let total = 0;
  for (const inv of INVESTMENTS) {
    if (!sabotaged(state, inv.id, now)) total += (state.investments[inv.id] ?? 0) * inv.incomePerMin;
  }
  return total * (1 + perk(state, 'incomeBonus'));
}

export function heatDecayRate(state) {
  return 1 + perk(state, 'heatDecay');
}

// Advances time-based systems and returns a new state.
// incomeCapMs limits how much time counts for income and interest (offline cap).
export function tick(state, now, { incomeCapMs = Infinity } = {}) {
  const elapsed = now - state.lastTick;
  if (elapsed <= 0) return state;
  const s = clone(state);
  s.lastTick = now;
  s.nerve = Math.min(nerveMax(s), s.nerve + elapsed / nerveRegenMs(s));
  s.heat = Math.max(0, s.heat - (elapsed / HEAT_DECAY_MS) * heatDecayRate(s));
  const paidMs = Math.min(elapsed, incomeCapMs);
  if (!vaultFrozen(state, state.lastTick)) accrueInterest(s, paidMs);
  for (const [id, until] of Object.entries(s.sabotage)) if (until <= now) delete s.sabotage[id];
  // Income piles up in a fractional pot; whole dollars move into cash.
  s.incomePot = (s.incomePot ?? 0) + incomePerMin(s) * paidMs / 60_000;
  const whole = Math.floor(s.incomePot + 1e-9);
  if (whole > 0) {
    s.cash += whole;
    s.stats.earned += whole;
    s.incomePot = Math.max(0, s.incomePot - whole);
  }
  if (incomeCapMs === Infinity) {
    s.stats.playMs += elapsed;
    if (activeRaider(s) && !inJail(state, state.lastTick)) s.raidIn = Math.max(0, s.raidIn - elapsed);
    gangsTick(s, elapsed);
  }
  const events = [];
  winCheck(s, events);
  addLog(s, events, now);
  return s;
}

// Catches up on time spent away. Returns { state, events, summary }.
export function applyOffline(state, now, rng) {
  const elapsed = Math.max(0, now - state.lastTick);
  const summary = { elapsed, income: 0, interest: 0, notable: false };
  if (elapsed === 0) return { state, events: [], summary };
  const cashBefore = state.cash;
  const vaultBefore = state.vault.balance;
  const s = tick(state, now, { incomeCapMs: offlineCapMs(state) });
  summary.income = s.cash - cashBefore;
  summary.interest = Math.floor(s.vault.balance - vaultBefore);
  const events = [];
  let out = s;
  if (elapsed > OFFLINE_RAID_AFTER_MS && s.cash > 0 && activeRaider(s)) {
    const raid = resolveRaid(s, rng, now);
    out = raid.state;
    summary.raid = raid.repelled ? 'repelled' : 'lost';
    summary.stolen = raid.stolen;
  }
  // Worth a welcome-back popup: a real break, or something happened.
  summary.notable = elapsed >= OFFLINE_RAID_AFTER_MS || !!summary.raid;
  if (summary.income > 0 || summary.interest > 0) {
    events.push(good(`While you were away your businesses made ${money(summary.income)}${summary.interest > 0 ? ` and the vault earned ${money(summary.interest)}` : ''}.`));
  }
  addLog(out, events, now);
  // Metal prices keep moving while you're away (a very long gap re-draws them).
  out = marketTick(out, now, rng);
  return { state: out, events, summary };
}

export function rivalState(state, rivalId) {
  const r = RIVALS.find((x) => x.id === rivalId);
  return { hp: r.hp, defeated: false, grownMs: 0, quietMs: 0, ...state.rivals[rivalId] };
}

// A gang can be fought (and raids) from its rank on; the Commission only
// once every other gang is gone.
export function rivalUnlocked(state, r) {
  if (r.rank > rankIndex(state)) return false;
  return !r.last || RIVALS.every((g) => g === r || rivalState(state, g.id).defeated);
}

const rivalActive = (state, r) => rivalUnlocked(state, r) && !rivalState(state, r.id).defeated;

// A gang's power grows while you leave it alone (play time only).
export function rivalPower(state, r) {
  const growth = Math.min(GANGS.growthMax, GANGS.growthPerHour * rivalState(state, r.id).grownMs / 3_600_000);
  return Math.round(r.power * (1 + growth));
}

// Active play: gangs grow, and hurt gangs heal 1 hp per healMs without a fight.
function gangsTick(s, elapsed) {
  for (const r of RIVALS) {
    if (!rivalActive(s, r)) continue;
    const rs = rivalState(s, r.id);
    rs.grownMs += elapsed;
    if (rs.hp < r.hp) {
      rs.quietMs += elapsed;
      while (rs.quietMs >= GANGS.healMs && rs.hp < r.hp) {
        rs.hp += 1;
        rs.quietMs -= GANGS.healMs;
      }
    }
    if (rs.hp >= r.hp) rs.quietMs = 0;
    s.rivals[r.id] = rs;
  }
}

export function fightOdds(state, rival) {
  const p = power(state);
  return clamp(p / (p + rivalPower(state, rival)) + perk(state, 'fightOdds'), 0.05, 0.95);
}

export function attackRival(state, rivalId, rng, now) {
  const r = RIVALS.find((x) => x.id === rivalId);
  if (!r) return refuse(state, 'unknown', 'Unknown gang.');
  if (!rivalUnlocked(state, r)) {
    return refuse(state, 'locked', r.last && r.rank <= rankIndex(state)
      ? `${r.name} only deal with whoever is left standing. Wipe out the other gangs first.`
      : `You need to be a ${RANKS[r.rank].name} to take on ${r.name}.`);
  }
  if (rivalState(state, rivalId).defeated) return refuse(state, 'defeated', `${r.name} are history.`);
  if (inJail(state, now)) return refuse(state, 'jail', "You're in jail.");
  if (state.encounter) return refuse(state, 'encounter', 'Deal with the trouble in front of you first.');
  if (state.nerve < ATTACK_NERVE) return refuse(state, 'nerve', `You need ${ATTACK_NERVE} nerve to start a war.`);

  const s = clone(state);
  const events = [];
  s.nerve -= ATTACK_NERVE;
  const won = rng() < fightOdds(s, r);
  const rs = rivalState(s, rivalId);
  rs.quietMs = 0;
  if (won) {
    rs.hp -= 1;
    rs.grownMs = 0;
    const loot = Math.round((r.loot[0] + rng() * (r.loot[1] - r.loot[0])) * (1 + perk(s, 'gangLoot')));
    let respect = r.respect;
    let sp = 0;
    events.push(good(`You hit ${r.name} hard. +${money(loot)}, +${r.respect} respect.`));
    if (rs.hp <= 0) {
      rs.hp = 0;
      rs.defeated = true;
      respect += r.defeatRespect;
      sp += r.defeatSp;
      if (s.raidFrom === r.id) s.raidFrom = null;
      events.push(good(`${r.boss} is finished. ${r.name} are no more! +${r.defeatRespect} respect, +${r.defeatSp} SP.`));
    }
    s.rivals[rivalId] = rs;
    reward(s, { cash: loot, respect, sp }, events);
  } else {
    s.rivals[rivalId] = rs;
    const lost = Math.round(s.cash * FIGHT_LOSS_CASH);
    s.cash -= lost;
    addHeat(s, FIGHT_LOSS_HEAT);
    events.push(bad(`${r.name} fought you off. You lost ${money(lost)} and the shooting drew heat.`));
  }
  // A gang that is still standing may hit back soon.
  if (!rs.defeated && rng() < GANGS.retaliateChance) {
    const delay = Math.round(GANGS.retaliateMs[0] + rng() * (GANGS.retaliateMs[1] - GANGS.retaliateMs[0]));
    s.raidFrom = r.id;
    s.raidIn = Math.min(s.raidIn, delay);
    events.push(bad(`${r.boss} swears revenge. Expect ${r.name} at your door within minutes.`));
  }
  winCheck(s, events);
  addLog(s, events, now);
  return { ok: true, won, state: s, events };
}

// The gang that will raid next if known (a retaliating gang), otherwise the
// strongest active gang; null when no gang can raid.
export function activeRaider(state) {
  const forced = RIVALS.find((r) => r.id === state.raidFrom);
  if (forced && rivalActive(state, forced)) return forced;
  let raider = null;
  for (const r of RIVALS) if (rivalActive(state, r)) raider = r;
  return raider;
}

export const activeRaiders = (state) => RIVALS.filter((r) => rivalActive(state, r));

export function raidOdds(state, rival) {
  const d = defense(state);
  return clamp(d / (d + rivalPower(state, rival)) + perk(state, 'raidOdds'), 0.05, 0.95);
}

function stealCash(s, rng, r, loss, events) {
  const frac = RAID_STEAL[0] + rng() * (RAID_STEAL[1] - RAID_STEAL[0]);
  const stolen = Math.round(s.cash * frac * loss);
  s.cash -= stolen;
  events.push(bad(`${r.name} raided you and took ${money(stolen)} of your cash. The vault held.`));
  return stolen;
}

// What a raid that got through does, by gang. Falls back to stealing cash
// when there is nothing of that kind to hit.
function raidEffect(s, r, rng, now, events) {
  const loss = 1 - perk(s, 'raidLoss');
  if (r.raid === 'heat') {
    const heat = GANGS.heatRaid * loss;
    addHeat(s, heat);
    events.push(bad(`${r.name} tipped off the cops about you. +${Math.round(heat)} heat.`));
    return 0;
  }
  if (r.raid === 'weapons') {
    const total = WEAPONS.reduce((n, w) => n + weaponCount(s, w.id), 0);
    if (total > 0) {
      let take = Math.min(total, Math.max(1, Math.ceil(total * GANGS.weaponSteal * loss)));
      const n = take;
      for (let left = total; take > 0; take--, left--) {
        // Pick a copy at random: each weapon type in proportion to its copies.
        let pick = Math.floor(rng() * left);
        const w = WEAPONS.find((x) => (pick -= weaponCount(s, x.id)) < 0);
        s.weapons[w.id] -= 1;
        if (s.weapons[w.id] === 0) delete s.weapons[w.id];
      }
      events.push(bad(`${r.name} rode off with ${n} of your crew's weapons.`));
      return 0;
    }
  }
  if (r.raid === 'sabotage') {
    let best = null;
    let bestIncome = 0;
    for (const inv of INVESTMENTS) {
      const income = (s.investments[inv.id] ?? 0) * inv.incomePerMin;
      if (income > bestIncome) { best = inv; bestIncome = income; }
    }
    if (best) {
      const ms = Math.round(GANGS.sabotageMs * loss);
      s.sabotage[best.id] = now + ms;
      events.push(bad(`${r.name} wrecked your ${best.name} business. It earns nothing for ${Math.round(ms / 60_000)} min.`));
      return 0;
    }
  }
  if (r.raid === 'hack' && s.vault.balance >= 1) {
    const ms = Math.round(GANGS.freezeMs * loss);
    s.vaultFrozenUntil = now + ms;
    events.push(bad(`${r.name} hacked your vault. It's frozen for ${Math.round(ms / 60_000)} min: no deposits, withdrawals or interest.`));
    return 0;
  }
  return stealCash(s, rng, r, loss, events);
}

// A gang raids you: the one retaliating, otherwise a random active gang.
// Resets the raid timer.
export function resolveRaid(state, rng, now) {
  const raiders = activeRaiders(state);
  const forced = RIVALS.find((g) => g.id === state.raidFrom);
  let r = null;
  if (forced && rivalActive(state, forced)) r = forced;
  else if (raiders.length === 1) r = raiders[0];
  else if (raiders.length > 1) r = raiders[Math.min(raiders.length - 1, Math.floor(rng() * raiders.length))];
  const s = clone(state);
  s.raidFrom = null;
  const events = [];
  let repelled = false;
  let stolen = 0;
  if (r) {
    repelled = rng() < raidOdds(s, r);
    if (repelled) {
      s.stats.raidsRepelled += 1;
      events.push(good(`${r.name} raided you, but you drove them off. +${r.raidRespect} respect.`));
      reward(s, { respect: r.raidRespect }, events);
    } else {
      s.stats.raidsSuffered += 1;
      stolen = raidEffect(s, r, rng, now, events);
    }
  }
  s.raidIn = Math.round(RAID_MIN_MS + rng() * (RAID_MAX_MS - RAID_MIN_MS));
  addLog(s, events, now);
  return { ok: true, raider: r?.id ?? null, repelled, stolen, state: s, events };
}

function winCheck(s, events) {
  if (s.won) return;
  const allBeaten = RIVALS.every((r) => rivalState(s, r.id).defeated);
  if (allBeaten && s.respect >= GODFATHER.respect && netWorth(s) >= GODFATHER.netWorth) {
    s.won = true;
    s.wonAt = s.stats.playMs;
    events.push(good('The whole town bows to you. You are the Godfather!'));
  }
}

export function checkWin(state, now) {
  const s = clone(state);
  const events = [];
  winCheck(s, events);
  addLog(s, events, now);
  return { ok: true, state: s, events };
}
