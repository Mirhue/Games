// Balance simulation: bots play the real engine in 1-second steps of active
// play and report when they reach each rank and the Godfather win.
//
//   node tools/sim.js [hours=14] [seeds=5] [style=all]
//
// Styles: balanced, weapons (arms the crew first), business (buys businesses
// first), nerve (pushes every nerve/heat perk first), rivals (saves nerve for
// gang fights). "Nothing is overpowered" means no focus style reaches
// Godfather much faster than the balanced bot.
import { newState } from '../js/state.js';
import {
  tick, doMission, payBail, bribeCops, buySkill, buyWeapon, upgradeVault, deposit, withdraw,
  buyInvestment, attackRival, resolveRaid, activeRaider, rankIndex, successChance, perk,
  inJail, bailCost, bribeCost, investmentPrice, rivalState, fightOdds, netWorth,
  skillCost, skillUnlocked, weaponPrice, jobNerve,
} from '../js/engine.js';
import { MISSIONS, RANKS, SKILLS, WEAPONS, VAULTS, INVESTMENTS, RIVALS, ATTACK_NERVE, GODFATHER } from '../js/data.js';
import { mulberry32 } from '../js/rng.js';

const STEP = 1000;
const STYLES = ['balanced', 'weapons', 'business', 'nerve', 'rivals'];
const hours = Number(process.argv[2] ?? 14);
const seeds = Number(process.argv[3] ?? 5);
const only = process.argv[4] ?? 'all';

const NERVE_KEYS = ['nerveRegen', 'nerveMax', 'heatDecay', 'heatReduction'];
const hasNervePerk = (perks = {}) => NERVE_KEYS.some((k) => perks[k]);

// How many dollars one respect point is worth to the bot right now.
const respectValue = (s) => 20 * 6 ** rankIndex(s);

// The job with the best value per nerve (mastery and outgrown discounts
// included). Cheap filler jobs are never better: nerve refills all the time,
// so spending it on a filler only delays the best job.
function bestMission(s) {
  const payout = 1 + perk(s, 'payoutBonus');
  const score = (m) => (successChance(s, m) * (((m.cash[0] + m.cash[1]) / 2) * payout + m.respect * respectValue(s))) / jobNerve(s, m);
  return MISSIONS.filter((m) => m.tier <= rankIndex(s) + 1).reduce((a, b) => (score(b) > score(a) ? b : a));
}

const spendable = (s) => s.cash + Math.floor(s.vault.balance);

// Make sure `amount` is available as cash, pulling from the vault if needed.
function raise(s, amount, now) {
  if (s.cash >= amount || spendable(s) < amount) return s;
  return withdraw(s, amount - s.cash, now).state;
}

// Purchase options in the order this style prefers them.
function options(s, now, style) {
  const r = rankIndex(s);
  const out = { skills: [], weapons: [], vault: [], business: [] };

  const skills = [...SKILLS].sort((a, b) =>
    style === 'nerve' ? (b.branch === 'street') - (a.branch === 'street') : 0);
  for (const k of skills) {
    const cost = skillCost(s, k.id);
    if (cost !== null && skillUnlocked(s, k) && s.sp >= cost) out.skills.push(() => buySkill(s, k.id, now));
  }

  // Weapons: spend at most this share of your money on one more copy.
  const share = style === 'weapons' ? 0.5 : 0.1;
  for (const w of [...WEAPONS].reverse()) {
    const price = weaponPrice(s, w.id);
    const limit = style === 'nerve' && hasNervePerk(w.perks) ? 0.3 : share;
    if (w.rank <= r && price <= spendable(s) * limit) {
      const buy = () => buyWeapon(raise(s, price, now), w.id, now);
      buy.weapon = w;
      out.weapons.push(buy);
    }
  }

  const nextVault = VAULTS[s.vault.tier + 1];
  if (nextVault && spendable(s) >= nextVault.price * 2) {
    out.vault.push(() => upgradeVault(raise(s, nextVault.price, now), now));
  }

  // Businesses: buy while they pay back within this many minutes.
  const bonus = 1 + perk(s, 'incomeBonus');
  for (const inv of INVESTMENTS) {
    const price = investmentPrice(s, inv.id);
    let payback = style === 'business' ? 480 : 240;
    if (style === 'nerve' && hasNervePerk(inv.perks)) payback = 900;
    if (inv.rank <= r && spendable(s) >= price && price / (inv.incomePerMin * bonus) <= payback) {
      out.business.push(() => buyInvestment(raise(s, price, now), inv.id, now));
    }
  }

  const order = { weapons: ['weapons', 'skills', 'vault', 'business'], business: ['business', 'skills', 'vault', 'weapons'] }[style]
    ?? ['skills', 'weapons', 'vault', 'business'];
  if (style === 'nerve') {
    // Perk sources first, whatever their category.
    const perkyWeapons = out.weapons.filter((buy) => hasNervePerk(buy.weapon.perks));
    return [...out.skills, ...perkyWeapons, ...out.business, ...order.flatMap((c) => out[c])];
  }
  return order.flatMap((c) => out[c]);
}

function shop(s, now, style, onBuy) {
  for (let guard = 0; guard < 200; guard++) {
    let bought = null;
    for (const opt of options(s, now, style)) {
      const r = opt();
      if (r.ok) { bought = r; break; }
    }
    if (!bought) break;
    s = bought.state;
    onBuy();
  }
  return s;
}

function run(seed, style) {
  const rng = mulberry32(seed);
  let now = 0;
  let s = newState(now);
  const rankAt = { 0: 0 };
  const goalAt = {};
  let lastBuy = 0;
  let longestGap = 0;
  let busyUntil = 0;
  let winAt = null;
  let gapStart = 0;
  const onBuy = () => { if (now - lastBuy > longestGap) { longestGap = now - lastBuy; gapStart = lastBuy; } lastBuy = now; };
  const minOdds = style === 'rivals' ? 0.3 : 0.6;

  for (now = STEP; now <= hours * 3_600_000; now += STEP) {
    s = tick(s, now);
    if (!Number.isInteger(s.cash)) throw new Error(`cash drifted to ${s.cash} at ${now}`);
    if (s.raidIn <= 0 && activeRaider(s)) s = resolveRaid(s, rng, now).state;
    const r = rankIndex(s);
    if (rankAt[r] === undefined) rankAt[r] = now;
    if (goalAt.rivals === undefined && RIVALS.every((g) => rivalState(s, g.id).defeated)) goalAt.rivals = now;
    if (goalAt.respect === undefined && s.respect >= GODFATHER.respect) goalAt.respect = now;
    if (goalAt.wealth === undefined && netWorth(s) >= GODFATHER.netWorth) goalAt.wealth = now;
    if (s.won) { winAt = now; break; }
    if (now < busyUntil) continue;

    if (inJail(s, now)) {
      if (s.jailUntil - now > 30_000 && spendable(s) >= bailCost(s) * 3) s = payBail(raise(s, bailCost(s), now), now).state;
      continue;
    }
    if (s.heat > 50 && spendable(s) >= bribeCost(s) * 3) s = bribeCops(raise(s, bribeCost(s), now), now).state;
    s = shop(s, now, style, onBuy);

    const target = RIVALS.find((g) => g.rank <= r && !rivalState(s, g.id).defeated && fightOdds(s, g) >= minOdds);
    if (target && s.nerve >= ATTACK_NERVE) {
      s = attackRival(s, target.id, rng, now).state;
      busyUntil = now + STEP;
      continue;
    }
    // The rival rusher saves its nerve for the next fight.
    if (style === 'rivals' && target) continue;
    const m = bestMission(s);
    if (m && s.nerve >= jobNerve(s, m)) {
      s = doMission(s, m.id, rng, now).state;
      busyUntil = now + STEP;
    }
    if (s.vault.tier > 0 && s.cash > 0 && activeRaider(s) && s.raidIn < 60_000) s = deposit(s, s.cash, now).state;
  }
  longestGap = Math.max(longestGap, now - lastBuy);
  if (process.env.GAPS) console.log(`  ${style} seed ${seed}: longest gap starts at ${(gapStart / 60_000).toFixed(0)} min; end: sp ${s.sp}, skills ${JSON.stringify(s.skills)}, invest ${JSON.stringify(s.investments)}, weapons ${JSON.stringify(s.weapons)}, vault ${s.vault.tier}`);
  return { rankAt, winAt, longestGap, goalAt, s };
}

const mins = (ms) => (ms === undefined || ms === null ? '    -' : (ms / 60_000).toFixed(0).padStart(5));
console.log(`Simulating ${hours}h of active play, ${seeds} seeds (minutes)\n`);
console.log('style    seed | ' + RANKS.slice(1).map((x) => x.name.slice(0, 7).padStart(7)).join(' ') + ' | Godfthr |   gap | arrests | rivals respect wealth');
const summary = [];
for (const style of STYLES.filter((x) => only === 'all' || x === only)) {
  const wins = [];
  let maxGap = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const { rankAt, winAt, longestGap, goalAt, s } = run(seed, style);
    if (winAt !== null) wins.push(winAt);
    maxGap = Math.max(maxGap, longestGap);
    console.log(`${style.padEnd(8)} ${String(seed).padStart(4)} | ${RANKS.slice(1).map((_, i) => mins(rankAt[i + 1]).padStart(7)).join(' ')} | ${mins(winAt).padStart(7)} | ${mins(longestGap)} | ${String(s.stats.arrests).padStart(7)} | ${mins(goalAt.rivals)} ${mins(goalAt.respect)} ${mins(goalAt.wealth)}`);
  }
  const avg = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : null;
  summary.push({ style, avg, wins: wins.length, maxGap });
}
console.log('\nstyle     Godfather avg   vs balanced   wins   longest gap');
const base = summary.find((x) => x.style === 'balanced')?.avg;
for (const { style, avg, wins, maxGap } of summary) {
  const rel = base && avg ? `${(((avg - base) / base) * 100).toFixed(0).padStart(4)}%` : '    -';
  console.log(`${style.padEnd(9)} ${avg ? (avg / 3_600_000).toFixed(2).padStart(6) + ' h' : '      -'}        ${rel}       ${wins}/${seeds}   ${mins(maxGap)} min`);
}
