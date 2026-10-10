// Balance simulation: a greedy bot plays the real engine in 1-second steps of
// active play and reports when it reaches each rank and the Godfather win.
// Usage: node tools/sim.js [hours=14] [seeds=5]
import { newState } from '../js/state.js';
import {
  tick, doMission, payBail, bribeCops, buySkill, buyWeapon, upgradeVault, deposit, withdraw,
  buyInvestment, attackRival, resolveRaid, activeRaider, rankIndex, successChance, skillEffect,
  inJail, bailCost, bribeCost, investmentPrice, incomePerMin, rivalState, fightOdds, netWorth,
} from '../js/engine.js';
import { MISSIONS, RANKS, SKILLS, WEAPONS, VAULTS, INVESTMENTS, RIVALS, ATTACK_NERVE, GODFATHER } from '../js/data.js';
import { mulberry32 } from '../js/rng.js';

const STEP = 1000;
const WORK_STEPS = 1;   // a job takes about 1 s of the player's time
const hours = Number(process.argv[2] ?? 14);
const seeds = Number(process.argv[3] ?? 5);

function bestMission(s) {
  const payout = 1 + skillEffect(s, 'payoutBonus');
  let best = null;
  let bestScore = -Infinity;
  for (const m of MISSIONS) {
    if (m.tier > rankIndex(s) + 1) continue;
    const c = successChance(s, m);
    // Value cash and respect (respect is what unlocks the next tier).
    const score = (c * (((m.cash[0] + m.cash[1]) / 2) * payout + m.respect * respectValue(s))) / m.nerve;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// How many dollars one respect point is worth to the bot right now.
const respectValue = (s) => 20 * 6 ** rankIndex(s);

function spendable(s) { return s.cash + Math.floor(s.vault.balance); }

// Make sure `amount` is available as cash, pulling from the vault if needed.
function raise(s, amount, now) {
  if (s.cash >= amount) return s;
  if (spendable(s) < amount) return s;
  return withdraw(s, amount - s.cash, now).state;
}

function shop(s, now, onBuy) {
  let bought = true;
  while (bought) {
    bought = false;
    const options = [];
    for (const k of SKILLS) {
      if (s.skills[k.id] || s.sp < k.cost) continue;
      if (k.idx > 1 && !s.skills[`${k.branch}${k.idx - 1}`]) continue;
      options.push(() => buySkill(s, k.id, now));
    }
    for (const w of WEAPONS) {
      if (!s.weapons[w.id] && w.rank <= rankIndex(s) && spendable(s) >= w.price) {
        options.push(() => buyWeapon(raise(s, w.price, now), w.id, now));
      }
    }
    const nextVault = VAULTS[s.vault.tier + 1];
    if (nextVault && spendable(s) >= nextVault.price * 2) {
      options.push(() => upgradeVault(raise(s, nextVault.price, now), now));
    }
    const bonus = 1 + skillEffect(s, 'incomeBonus');
    for (const inv of INVESTMENTS) {
      const price = investmentPrice(s, inv.id);
      if (inv.rank <= rankIndex(s) && spendable(s) >= price && price / (inv.incomePerMin * bonus) <= 240) {
        options.push(() => buyInvestment(raise(s, price, now), inv.id, now));
      }
    }
    for (const opt of options) {
      const r = opt();
      if (r.ok) { s = r.state; bought = true; onBuy(); break; }
    }
  }
  return s;
}

function run(seed) {
  const rng = mulberry32(seed);
  let now = 0;
  let s = newState(now);
  const rankAt = { 0: 0 };
  let lastBuy = 0;
  let longestGap = 0;
  let gapStart = 0;
  let busyUntil = 0;
  let winAt = null;
  const goalAt = {};
  const onBuy = () => { if (now - lastBuy > longestGap) { longestGap = now - lastBuy; gapStart = lastBuy; } lastBuy = now; };

  for (now = STEP; now <= hours * 3_600_000; now += STEP) {
    s = tick(s, now);
    if (s.raidIn <= 0 && activeRaider(s)) s = resolveRaid(s, rng, now).state;
    const r = rankIndex(s);
    if (rankAt[r] === undefined) rankAt[r] = now;
    if (s.won && winAt === null) winAt = now;
    if (goalAt.rivals === undefined && RIVALS.every((g) => rivalState(s, g.id).defeated)) goalAt.rivals = now;
    if (goalAt.respect === undefined && s.respect >= GODFATHER.respect) goalAt.respect = now;
    if (goalAt.wealth === undefined && netWorth(s) >= GODFATHER.netWorth) goalAt.wealth = now;
    if (winAt !== null) break;
    if (now < busyUntil) continue;

    if (inJail(s, now)) {
      if (s.jailUntil - now > 30_000 && spendable(s) >= bailCost(s) * 3) {
        s = payBail(raise(s, bailCost(s), now), now).state;
      }
      continue;
    }
    if (s.heat > 50 && spendable(s) >= bribeCost(s) * 3) s = bribeCops(raise(s, bribeCost(s), now), now).state;
    s = shop(s, now, onBuy);

    // Fight a rival when the odds are good.
    const target = RIVALS.find((g) => g.rank <= r && !rivalState(s, g.id).defeated && fightOdds(s, g) >= 0.6);
    if (target && s.nerve >= ATTACK_NERVE) {
      s = attackRival(s, target.id, rng, now).state;
      busyUntil = now + WORK_STEPS * STEP;
      continue;
    }
    const m = bestMission(s);
    if (m && s.nerve >= m.nerve) {
      s = doMission(s, m.id, rng, now).state;
      busyUntil = now + WORK_STEPS * STEP;
    }
    // Bank cash when a raid is coming.
    if (s.vault.tier > 0 && s.cash > 0 && activeRaider(s) && s.raidIn < 60_000) s = deposit(s, s.cash, now).state;
  }
  longestGap = Math.max(longestGap, now - lastBuy);
  if (!Number.isInteger(s.cash)) throw new Error(`cash drifted to ${s.cash}`);
  if (process.env.GAPS) console.log(`seed ${seed}: longest gap starts at ${(gapStart / 60000).toFixed(0)}m, rank ${RANKS[rankIndex(s)].name}, sp ${s.sp}, skills ${Object.keys(s.skills).length}`);
  return { rankAt, winAt, longestGap, s, goalAt };
}

const mins = (ms) => (ms === undefined || ms === null ? '   -  ' : (ms / 60_000).toFixed(0).padStart(5) + 'm');
console.log(`Simulating ${hours}h of active play, ${seeds} seeds\n`);
console.log('seed | ' + RANKS.map((r) => r.name.padEnd(10)).join(' ') + ' | Godfather | gap  | arrests | net worth   | rivals');
for (let seed = 1; seed <= seeds; seed++) {
  const { rankAt, winAt, longestGap, s, goalAt } = run(seed);
  const rivals = RIVALS.map((g) => (rivalState(s, g.id).defeated ? 'X' : rivalState(s, g.id).hp)).join('/');
  console.log(`${String(seed).padStart(4)} | ${RANKS.map((_, i) => mins(rankAt[i]).padEnd(10)).join(' ')} | ${mins(winAt).padEnd(9)} | ${mins(longestGap)} | ${String(s.stats.arrests).padStart(7)} | ${('$' + Math.round(netWorth(s)).toExponential(2)).padEnd(11)} | ${rivals}  goals rivals${mins(goalAt.rivals)} respect${mins(goalAt.respect)} wealth${mins(goalAt.wealth)}`);
}
