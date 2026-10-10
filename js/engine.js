// Pure game rules. Every action takes the state (plus rng/now where needed),
// works on a copy and returns { ok, state, events, reason? }.
import {
  NERVE_MAX_BASE, NERVE_REGEN_MS, RANKS, MISSIONS,
  HEAT_MAX, HEAT_DECAY_MS, HEAT_CHANCE_PENALTY, HEAT_ARREST_BONUS, ARREST_BASE,
  JAIL_MS_PER_TIER, SEIZE_FRACTION, BAIL_MIN, BAIL_NET_WORTH_FRACTION, BRIBE_PER_HEAT, SKILLS,
  BASE_POWER, WEAPON_BONUS_CAP, WEAPONS, VAULTS,
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

export function skillEffect(state, key) {
  let total = 0;
  for (const k of SKILLS) if (state.skills[k.id]) total += k.effects[key] ?? 0;
  return total;
}

export function buySkill(state, skillId, now) {
  const k = SKILLS.find((x) => x.id === skillId);
  if (!k) return refuse(state, 'unknown', 'Unknown skill.');
  if (state.skills[k.id]) return refuse(state, 'owned', 'You already know that.');
  const prev = SKILLS.find((x) => x.branch === k.branch && x.idx === k.idx - 1);
  if (prev && !state.skills[prev.id]) return refuse(state, 'order', `Learn ${prev.name} first.`);
  if (state.sp < k.cost) return refuse(state, 'sp', `You need ${k.cost} SP.`);
  const s = clone(state);
  s.sp -= k.cost;
  s.skills[k.id] = true;
  const events = [good(`You learned ${k.name}.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function bestWeapon(state) {
  let best = null;
  for (const w of WEAPONS) if (state.weapons[w.id] && (!best || w.power > best.power)) best = w;
  return best;
}

export function weaponBonus(state) {
  return Math.min(WEAPON_BONUS_CAP, bestWeapon(state)?.bonus ?? 0);
}

export function power(state) {
  return BASE_POWER + (bestWeapon(state)?.power ?? 0) + skillEffect(state, 'power');
}

export function defense(state) {
  return BASE_POWER + (bestWeapon(state)?.power ?? 0) + skillEffect(state, 'defense');
}

export function buyWeapon(state, weaponId, now) {
  const w = WEAPONS.find((x) => x.id === weaponId);
  if (!w) return refuse(state, 'unknown', 'Unknown weapon.');
  if (state.weapons[w.id]) return refuse(state, 'owned', 'You already own that.');
  if (w.rank > rankIndex(state)) return refuse(state, 'locked', `Dealers only sell that to a ${RANKS[w.rank].name}.`);
  if (state.cash < w.price) return refuse(state, 'cash', `You need ${money(w.price)} in cash.`);
  const s = clone(state);
  s.cash -= w.price;
  s.weapons[w.id] = true;
  const events = [good(`You bought a ${w.name}.`)];
  addLog(s, events, now);
  return { ok: true, state: s, events };
}

export function nerveMax(state) {
  return NERVE_MAX_BASE + skillEffect(state, 'nerveMax');
}

export function successChance(state, mission) {
  const chance = mission.baseChance
    + skillEffect(state, `${mission.type}Chance`)
    + (mission.type === 'muscle' ? weaponBonus(state) : 0)
    - state.heat * HEAT_CHANCE_PENALTY;
  return clamp(chance, 0.05, 0.95);
}

export function arrestChance(state, mission) {
  return clamp(ARREST_BASE[mission.tier - 1] + state.heat * HEAT_ARREST_BONUS, 0, 0.95);
}

export function netWorth(state) {
  return state.cash + state.vault.balance;
}

export const inJail = (state, now) => state.jailUntil > now;

const heatGained = (s, amount) => amount * (1 - Math.min(0.9, skillEffect(s, 'heatReduction')));

function addHeat(s, amount) {
  s.heat = clamp(s.heat + amount, 0, HEAT_MAX);
}

export function bailCost(state) {
  const discount = Math.min(0.9, skillEffect(state, 'bailDiscount'));
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
    const cash = Math.round(base * (1 + skillEffect(s, 'payoutBonus')));
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

// Advances time-based systems. Returns a new state.
export function tick(state, now) {
  const elapsed = now - state.lastTick;
  if (elapsed <= 0) return state;
  const s = clone(state);
  s.lastTick = now;
  s.nerve = Math.min(nerveMax(s), s.nerve + elapsed / NERVE_REGEN_MS);
  s.heat = Math.max(0, s.heat - elapsed / HEAT_DECAY_MS);
  accrueInterest(s, elapsed);
  return s;
}
