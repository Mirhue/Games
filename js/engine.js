// Pure game rules. Every action takes the state (plus rng/now where needed),
// works on a copy and returns { ok, state, events, reason? }.
import {
  NERVE_MAX_BASE, NERVE_REGEN_MS, RANKS, MISSIONS,
  HEAT_MAX, HEAT_DECAY_MS, HEAT_CHANCE_PENALTY, HEAT_ARREST_BONUS, ARREST_BASE,
  JAIL_MS_PER_TIER, SEIZE_FRACTION, BAIL_MIN, BAIL_NET_WORTH_FRACTION, BRIBE_PER_HEAT, SKILLS, SKILL_GROWTH,
  BASE_POWER, WEAPON_BONUS_CAP, WEAPON_GROWTH, WEAPONS, VAULTS,
  INVESTMENTS, INVESTMENT_GROWTH, PERK_CAPS, OFFLINE_CAP_MS,
  RIVALS, ATTACK_NERVE, FIGHT_LOSS_HEAT, FIGHT_LOSS_CASH, RAID_MIN_MS, RAID_MAX_MS, RAID_STEAL,
  OFFLINE_RAID_AFTER_MS, GODFATHER,
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

export const skillEffect = perk;  // v1 name, kept for callers

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

export function skillUnlocked(state, k) {
  const prev = SKILLS.find((x) => x.branch === k.branch && x.idx === k.idx - 1);
  return !prev || skillLevel(state, prev.id) >= 1;
}

// Learns a skill or raises it by one level.
export function buySkill(state, skillId, now) {
  const k = SKILLS.find((x) => x.id === skillId);
  if (!k) return refuse(state, 'unknown', 'Unknown skill.');
  if (!skillUnlocked(state, k)) {
    const prev = SKILLS.find((x) => x.branch === k.branch && x.idx === k.idx - 1);
    return refuse(state, 'order', `Learn ${prev.name} first.`);
  }
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
  return BASE_POWER + crewPower(state) + perk(state, 'power');
}

export function defense(state) {
  return BASE_POWER + crewPower(state) + perk(state, 'defense');
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

export function successChance(state, mission) {
  const chance = mission.baseChance
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
  return Math.round(state.cash + state.vault.balance + businesses);
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
  return Math.round(Math.ceil(state.heat) * BRIBE_PER_HEAT[rankIndex(state)]);
}

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
  if (state.nerve < m.nerve) return refuse(state, 'nerve', 'Not enough nerve. Catch your breath.');

  const s = clone(state);
  const events = [];
  s.nerve -= m.nerve;
  s.stats.missions += 1;
  const success = rng() < successChance(s, m);
  let arrested = false;
  if (success) {
    addHeat(s, heatGained(s, m.heat));
    const base = m.cash[0] + rng() * (m.cash[1] - m.cash[0]);
    const cash = Math.round(base * (1 + perk(s, 'payoutBonus')));
    s.stats.successes += 1;
    events.push(good(`${m.name}: success! +${money(cash)}, +${m.respect} respect, +${m.sp} SP.`));
    reward(s, { cash, respect: m.respect, sp: m.sp }, events);
  } else {
    arrested = rng() < arrestChance(s, m);
    addHeat(s, heatGained(s, m.heat / 2));
    if (arrested) {
      const seized = Math.round(s.cash * SEIZE_FRACTION);
      s.cash -= seized;
      s.jailUntil = now + JAIL_MS_PER_TIER * m.tier;
      s.stats.arrests += 1;
      events.push(bad(`${m.name}: busted! The cops seized ${money(seized)} and locked you up for ${m.tier * JAIL_MS_PER_TIER / 1000}s.`));
    } else {
      events.push(bad(`${m.name}: it went wrong. You got away empty-handed.`));
    }
  }
  winCheck(s, events);
  addLog(s, events, now);
  return { ok: true, success, arrested, state: s, events };
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

export function deposit(state, amount, now) {
  const v = VAULTS[state.vault.tier];
  if (state.vault.tier === 0) return refuse(state, 'novault', 'You need a place to stash your money first.');
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

export function incomePerMin(state) {
  let total = 0;
  for (const inv of INVESTMENTS) total += (state.investments[inv.id] ?? 0) * inv.incomePerMin;
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
  accrueInterest(s, paidMs);
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
  const s = tick(state, now, { incomeCapMs: OFFLINE_CAP_MS });
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
  return { state: out, events, summary };
}

export function rivalState(state, rivalId) {
  const r = RIVALS.find((x) => x.id === rivalId);
  return state.rivals[rivalId] ?? { hp: r.hp, defeated: false };
}

const rivalUnlocked = (state, r) => r.rank <= rankIndex(state);

export function fightOdds(state, rival) {
  return clamp(power(state) / (power(state) + rival.power), 0.05, 0.95);
}

export function attackRival(state, rivalId, rng, now) {
  const r = RIVALS.find((x) => x.id === rivalId);
  if (!r) return refuse(state, 'unknown', 'Unknown gang.');
  if (!rivalUnlocked(state, r)) return refuse(state, 'locked', `You need to be a ${RANKS[r.rank].name} to take on ${r.name}.`);
  if (rivalState(state, rivalId).defeated) return refuse(state, 'defeated', `${r.name} are history.`);
  if (inJail(state, now)) return refuse(state, 'jail', "You're in jail.");
  if (state.nerve < ATTACK_NERVE) return refuse(state, 'nerve', `You need ${ATTACK_NERVE} nerve to start a war.`);

  const s = clone(state);
  const events = [];
  s.nerve -= ATTACK_NERVE;
  const won = rng() < fightOdds(s, r);
  if (won) {
    const rs = { ...rivalState(s, rivalId) };
    rs.hp -= 1;
    const loot = Math.round(r.loot[0] + rng() * (r.loot[1] - r.loot[0]));
    let respect = r.respect;
    events.push(good(`You hit ${r.name} hard. +${money(loot)}, +${r.respect} respect.`));
    if (rs.hp <= 0) {
      rs.hp = 0;
      rs.defeated = true;
      respect += r.defeatRespect;
      events.push(good(`${r.boss} is finished. ${r.name} are no more! +${r.defeatRespect} respect.`));
    }
    s.rivals[rivalId] = rs;
    reward(s, { cash: loot, respect }, events);
  } else {
    const lost = Math.round(s.cash * FIGHT_LOSS_CASH);
    s.cash -= lost;
    addHeat(s, FIGHT_LOSS_HEAT);
    events.push(bad(`${r.name} fought you off. You lost ${money(lost)} and the shooting drew heat.`));
  }
  winCheck(s, events);
  addLog(s, events, now);
  return { ok: true, won, state: s, events };
}

export function activeRaider(state) {
  let raider = null;
  for (const r of RIVALS) {
    if (rivalUnlocked(state, r) && !rivalState(state, r.id).defeated) raider = r;
  }
  return raider;
}

export function raidOdds(state, rival) {
  return clamp(defense(state) / (defense(state) + rival.power), 0.05, 0.95);
}

// A rival raids your cash on hand. Resets the raid timer.
export function resolveRaid(state, rng, now) {
  const r = activeRaider(state);
  const s = clone(state);
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
      const frac = RAID_STEAL[0] + rng() * (RAID_STEAL[1] - RAID_STEAL[0]);
      stolen = Math.round(s.cash * frac);
      s.cash -= stolen;
      s.stats.raidsSuffered += 1;
      events.push(bad(`${r.name} raided you and took ${money(stolen)} of your cash. The vault held.`));
    }
  }
  s.raidIn = Math.round(RAID_MIN_MS + rng() * (RAID_MAX_MS - RAID_MIN_MS));
  addLog(s, events, now);
  return { ok: true, repelled, stolen, state: s, events };
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
