// Renders the game state into the page. Pure string building, no game rules.
import {
  MISSIONS, RANKS, SKILLS, SKILL_BRANCHES, WEAPONS, VAULTS, INVESTMENTS, RIVALS, GODFATHER,
  ATTACK_NERVE, HEAT_CHANCE_PENALTY, PERK_CAPS, MASTERY, OUTGROWN, METALS, MARKET,
} from './data.js';
import {
  rankIndex, rankName, nerveMax, successChance, arrestChance, perk, inJail, bailCost,
  bribeCost, netWorth, bestWeapon, power, defense, investmentPrice, incomePerMin, rivalState,
  fightOdds, raidOdds, activeRaider, skillLevel, skillCost, skillUnlocked, weaponCount,
  weaponPrice, weaponBonus, nerveRegenMs, heatDecayRate, masteryLevel, outgrownLevel, jobNerve,
  metalBuyPrice, metalSellPrice, maxBars,
} from './engine.js';

export const TABS = [
  ['jobs', 'Jobs'], ['skills', 'Skills'], ['arsenal', 'Arsenal'], ['vault', 'Vault'],
  ['business', 'Business'], ['market', 'Market'], ['rivals', 'Rivals'], ['stats', 'Stats'],
];

export function fmt(n) {
  const abs = Math.abs(n);
  // [divisor, suffix, threshold]: thousands only get a K from 10,000 up.
  const units = [[1e12, 'T', 1e12], [1e9, 'B', 1e9], [1e6, 'M', 1e6], [1e3, 'K', 1e4]];
  for (const [v, u, from] of units) {
    if (abs >= from) return '$' + (n / v).toFixed(abs >= v * 100 ? 0 : 1).replace(/\.0$/, '') + u;
  }
  return '$' + Math.floor(n).toLocaleString('en-US');
}

const pct = (x) => Math.round(x * 100) + '%';
const pct1 = (x) => Math.round(x * 1000) / 10 + '%';
const icon = (name, color = 'var(--gold)') =>
  // Inline so the URL resolves against the page, not the stylesheet.
  `<span class="icon" style="-webkit-mask-image:url(assets/icons/${name}.svg);mask-image:url(assets/icons/${name}.svg);background:${color}"></span>`;
const head = (iconName, title, color) => `<div class="head">${icon(iconName, color)}<div class="title">${title}</div></div>`;

// Human-readable text for a perk/effect object, e.g. "+1% stealth jobs, −2% job heat".
const PERK_TEXT = {
  stealthChance: (v) => `+${pct1(v)} stealth jobs`,
  muscleChance: (v) => `+${pct1(v)} muscle jobs`,
  brainsChance: (v) => `+${pct1(v)} brains jobs`,
  heatReduction: (v) => `−${pct1(v)} job heat`,
  payoutBonus: (v) => `+${pct1(v)} payouts`,
  incomeBonus: (v) => `+${pct1(v)} business income`,
  bailDiscount: (v) => `−${pct1(v)} bail`,
  nerveMax: (v) => `+${v} max nerve`,
  nerveRegen: (v) => `+${pct1(v)} nerve regen`,
  nerveCost: (v) => `−${pct1(v)} job nerve`,
  heatDecay: (v) => `+${pct1(v)} heat decay`,
  power: (v) => `+${v} power`,
  defense: (v) => `+${v} defense`,
};
export function describePerks(effects = {}) {
  const parts = [];
  for (const [key, v] of Object.entries(effects)) {
    if (key === 'defense' && effects.power === v) continue;
    if (key === 'power' && effects.defense === v) { parts.push(`+${v} power & defense`); continue; }
    parts.push(PERK_TEXT[key]?.(v) ?? `${key} ${v}`);
  }
  return parts.join(', ');
}
const secs = (ms) => {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};
const chanceClass = (c) => (c >= 0.7 ? 'chance-good' : c >= 0.45 ? 'chance-mid' : 'chance-bad');
const bar = (value, max, color) =>
  `<div class="bar"><i style="width:${Math.min(100, (value / max) * 100)}%;background:${color}"></i></div>`;
const btn = (action, label, { id = '', disabled = false, cls = '' } = {}) =>
  `<button data-action="${action}" data-id="${id}" class="${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const row = (label, value, cls = '') => `<div class="row"><span>${label}</span><b class="${cls}">${value}</b></div>`;

export function renderTopbar(s, now) {
  const r = rankIndex(s);
  const next = RANKS[r + 1];
  const rankProgress = next
    ? `${bar(s.respect - RANKS[r].respect, next.respect - RANKS[r].respect, 'var(--gold)')}`
    : '';
  const max = nerveMax(s);
  const vaultCap = VAULTS[s.vault.tier].capacity;
  return `
    <div class="brand">KINGPIN</div>
    <div class="stat"><span class="label">Rank</span><span class="value">${rankName(s)}</span>${rankProgress}</div>
    <div class="stat"><span class="label">Cash</span><span class="value">${fmt(s.cash)}</span></div>
    <div class="stat"><span class="label">Vault</span><span class="value">${s.vault.tier ? `${fmt(s.vault.balance)} / ${fmt(vaultCap)}` : '—'}</span></div>
    <div class="stat"><span class="label">Nerve ${Math.floor(s.nerve)}/${max} · +${(60_000 / nerveRegenMs(s)).toFixed(0)}/min</span>${bar(s.nerve, max, 'var(--nerve)')}</div>
    <div class="stat"><span class="label">Heat ${Math.ceil(s.heat)}</span>${bar(s.heat, 100, 'var(--heat)')}</div>
    <div class="stat"><span class="label">Respect</span><span class="value">${Math.floor(s.respect).toLocaleString('en-US')}${next ? ` / ${next.respect.toLocaleString('en-US')}` : ''}</span></div>
    <div class="stat"><span class="label">Skill points</span><span class="value">${s.sp}</span></div>
    <div class="stat"><span class="label">Income</span><span class="value">${fmt(incomePerMin(s))}/min</span></div>
    ${inJail(s, now) ? `<div class="stat"><span class="label">Status</span><span class="value" style="color:var(--bad)">In jail ${secs(s.jailUntil - now)}</span></div>` : ''}`;
}

export function renderTabs(active, s) {
  const affordableSkill = SKILLS.some((k) => skillUnlocked(s, k) && skillCost(s, k.id) !== null && s.sp >= skillCost(s, k.id));
  return TABS.map(([id, label]) => {
    const badge = id === 'skills' && affordableSkill ? '<span class="badge">!</span>' : '';
    return `<button data-action="tab" data-id="${id}" class="${id === active ? 'active' : ''}">${label}${badge}</button>`;
  }).join('');
}

function jailBanner(s, now) {
  if (!inJail(s, now)) return '';
  const cost = bailCost(s);
  return `<div class="banner"><span><b>You're behind bars.</b> Out in ${secs(s.jailUntil - now)}.</span>
    ${btn('bail', `Pay bail ${fmt(cost)}`, { disabled: s.cash < cost })}</div>`;
}

function heatBanner(s) {
  if (s.heat < 1) return '';
  const cost = bribeCost(s);
  return `<div class="banner info"><span>Heat ${Math.ceil(s.heat)}: −${pct(s.heat * HEAT_CHANCE_PENALTY)} success, more arrests.</span>
    ${btn('bribe', `Bribe the cops ${fmt(cost)}`, { disabled: s.cash < cost, cls: 'ghost' })}</div>`;
}

function jobsPanel(s, now, ui) {
  const r = rankIndex(s);
  const jailed = inJail(s, now);
  const payout = 1 + perk(s, 'payoutBonus');
  let html = `<h2>Jobs</h2><p class="hint">Every job costs nerve. Success pays cash, respect and skill points. Failure might land you in jail.
    Repeat a job to master it (cheaper, safer, and a Master sometimes gets the nerve back). Jobs far below your rank are outgrown: quick, cheap fillers.</p>`;
  html += jailBanner(s, now) + heatBanner(s);
  for (let tier = 1; tier <= 6; tier++) {
    const locked = tier > r + 1;
    html += `<h3>Tier ${tier} · ${RANKS[tier - 1].name}${locked ? ` — reach ${RANKS[tier - 1].respect.toLocaleString('en-US')} respect` : ''}</h3><div class="grid">`;
    for (const m of MISSIONS.filter((x) => x.tier === tier)) {
      const c = successChance(s, m);
      const working = ui.working === m.id;
      const cost = jobNerve(s, m);
      const evPerNerve = (c * ((m.cash[0] + m.cash[1]) / 2) * payout) / cost;
      const og = outgrownLevel(s, m);
      const heat = m.heat * OUTGROWN.heatFactor ** og * (1 - perk(s, 'heatReduction'));
      const ml = masteryLevel(s, m.id);
      const done = s.mastery[m.id] ?? 0;
      const next = MASTERY.levels[ml + 1];
      const mastery = next
        ? `${MASTERY.levels[ml].name} · ${done}/${next.at}`
        : `Master · ${pct(MASTERY.refundChance)} nerve back`;
      html += `<div class="card ${locked ? 'locked' : ''} ${working ? 'working' : ''}">
        ${head(m.icon, `${m.name} <span class="tag ${m.type}">${m.type}</span>${og ? ' <span class="tag outgrown">outgrown</span>' : ''}`, `var(--${m.type})`)}
        ${row('Success', pct(c), chanceClass(c))}
        ${row('Payout', `${fmt(m.cash[0] * payout)} – ${fmt(m.cash[1] * payout)}`)}
        ${row('Nerve', cost < m.nerve ? `<s class="was">${m.nerve}</s> ${cost}` : cost)}
        ${row('Respect / SP', `+${Math.floor(m.respect * OUTGROWN.rewardFactor ** og)} / +${Math.floor(m.sp * OUTGROWN.rewardFactor ** og)}`)}
        ${row('Heat / arrest if failed', `+${Math.round(heat * 10) / 10} / ${pct(arrestChance(s, m))}`)}
        ${row('Worth per nerve', `≈ ${fmt(evPerNerve)}`)}
        ${row('Mastery', mastery)}
        ${next ? bar(done - MASTERY.levels[ml].at, next.at - MASTERY.levels[ml].at, `var(--${m.type})`) : ''}
        ${btn('job', 'Do it', { id: m.id, disabled: locked || jailed || s.nerve < cost || !!ui.working })}
      </div>`;
    }
    html += '</div>';
    if (locked) break;   // show only the next locked tier as a teaser
  }
  return html;
}

function skillsPanel(s) {
  let html = `<h2>Skills</h2><p class="hint">You have <b>${s.sp}</b> skill points. Level 1 of a skill unlocks the next one in its branch; every skill can keep leveling up.</p><div class="columns">`;
  for (const branch of SKILL_BRANCHES) {
    html += `<div><h3><span class="tag ${branch.id}">${branch.name}</span></h3>`;
    for (const k of SKILLS.filter((x) => x.branch === branch.id)) {
      const level = skillLevel(s, k.id);
      const cost = skillCost(s, k.id);
      const unlocked = skillUnlocked(s, k);
      const total = Object.fromEntries(Object.entries(k.effects).map(([key, v]) => [key, Math.round(v * level * 1000) / 1000]));
      html += `<div class="card ${level ? 'owned' : unlocked ? '' : 'locked'}" style="margin-bottom:8px">
        ${head(k.icon, `${k.name}`)}
        ${row('Level', `${level} / ${k.maxLevel}`)}
        <div class="row"><span>Per level: ${describePerks(k.effects)}</span></div>
        ${level ? `<div class="row"><span>Now: ${describePerks(total)}</span></div>` : ''}
        ${cost === null ? '<div class="row"><b>Maxed out</b></div>'
          : btn('skill', `${level ? 'Upgrade' : 'Learn'} · ${cost} SP`, { id: k.id, disabled: !unlocked || s.sp < cost })}
      </div>`;
    }
    html += '</div>';
  }
  return html + '</div>';
}

function arsenalPanel(s) {
  const r = rankIndex(s);
  const best = bestWeapon(s);
  const crew = WEAPONS.reduce((n, w) => n + weaponCount(s, w.id), 0);
  let html = `<h2>Arsenal</h2><p class="hint">Every weapon you buy arms another member of your crew: all of them add power and defense, and each copy costs 25% more.
    Your best weapon type boosts muscle jobs by <b>${pct(weaponBonus(s))}</b>.
    Power <b>${power(s)}</b> · Defense <b>${defense(s)}</b> · Armed crew <b>${crew}</b>${best ? ` · Best: <b>${best.name}</b>` : ''}</p><div class="grid">`;
  for (const w of WEAPONS) {
    const count = weaponCount(s, w.id);
    const locked = w.rank > r;
    const price = weaponPrice(s, w.id);
    html += `<div class="card ${count ? 'owned' : locked ? 'locked' : ''}">
      ${head(w.icon, `${w.name}${count ? ` ×${count}` : ''}`)}
      ${row('Power each', `+${w.power}`)}
      ${row('Muscle jobs (best type)', `+${pct(w.bonus)}`)}
      ${w.perks ? row('Perk each', describePerks(w.perks)) : ''}
      ${row(count ? 'Next copy' : 'Price', fmt(price))}
      ${locked ? row('Requires', RANKS[w.rank].name) : ''}
      ${btn('weapon', count ? 'Buy another' : 'Buy', { id: w.id, disabled: locked || s.cash < price })}
    </div>`;
  }
  return html + '</div>';
}

function vaultPanel(s) {
  const v = VAULTS[s.vault.tier];
  const next = VAULTS[s.vault.tier + 1];
  let html = `<h2>Vault</h2><p class="hint">Cash on hand can be stolen by raiders and seized by the police. The vault is safe.</p>`;
  if (s.vault.tier > 0) {
    html += `<div class="card owned">
      <div class="title">${v.name}</div>
      ${row('Balance', `${fmt(s.vault.balance)} / ${fmt(v.capacity)}`)}
      ${row('Deposit fee', pct(v.fee))}
      ${row('Interest', v.interestPerHour ? `${(v.interestPerHour * 100).toFixed(1)}% per hour` : 'none')}
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input id="vault-amount" type="number" min="1" placeholder="Amount">
        ${btn('deposit', 'Deposit')} ${btn('withdraw', 'Withdraw', { cls: 'ghost' })}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${btn('deposit-all', 'Deposit all cash', { disabled: s.cash < 1 })}
        ${btn('withdraw-all', 'Withdraw all', { cls: 'ghost', disabled: s.vault.balance < 1 })}
      </div>
    </div>`;
  }
  if (next) {
    html += `<h3>Upgrade</h3><div class="grid"><div class="card">
      <div class="title">${next.name}</div>
      ${row('Capacity', fmt(next.capacity))}
      ${row('Deposit fee', pct(next.fee))}
      ${row('Interest', next.interestPerHour ? `${(next.interestPerHour * 100).toFixed(1)}% per hour` : 'none')}
      ${row('Price', fmt(next.price))}
      ${btn('vault-upgrade', s.vault.tier ? 'Upgrade' : 'Buy', { disabled: s.cash < next.price })}
    </div></div>`;
  }
  return html;
}

function businessPanel(s) {
  const r = rankIndex(s);
  let html = `<h2>Business</h2><p class="hint">Fronts earn money every minute, even while you're away (up to 2 hours). Total: <b>${fmt(incomePerMin(s))}/min</b></p><div class="grid">`;
  const bonus = 1 + perk(s, 'incomeBonus');
  for (const inv of INVESTMENTS) {
    const locked = inv.rank > r;
    const price = investmentPrice(s, inv.id);
    const count = s.investments[inv.id] ?? 0;
    html += `<div class="card ${locked ? 'locked' : count ? 'owned' : ''}">
      ${head(inv.icon, `${inv.name}${count ? ` ×${count}` : ''}`)}
      ${row('Income each', `${fmt(inv.incomePerMin * bonus)}/min`)}
      ${inv.perks ? row('Perk each', describePerks(inv.perks)) : ''}
      ${row('Price', fmt(price))}
      ${row('Pays back in', `${Math.ceil(price / (inv.incomePerMin * bonus))} min`)}
      ${locked ? row('Requires', RANKS[inv.rank].name) : ''}
      ${btn('invest', 'Buy', { id: inv.id, disabled: locked || s.cash < price })}
    </div>`;
  }
  return html + '</div>';
}

// Sparkline of the last 2 hours of prices, with the fair value as a dashed
// reference line and a native tooltip per minute.
function sparkline(history, fair, name) {
  const W = 240;
  const H = 56;
  const pad = 4;
  const lo = Math.min(...history, fair);
  const hi = Math.max(...history, fair);
  const span = hi - lo || 1;
  const n = history.length;
  const x = (i) => (n === 1 ? W - pad : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (p) => H - pad - ((p - lo) / span) * (H - 2 * pad);
  const points = history.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const step = n > 1 ? (W - 2 * pad) / (n - 1) : W;
  const hits = history.map((p, i) =>
    `<rect x="${(x(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H}" fill="transparent"><title>${n - 1 - i === 0 ? 'Now' : `${n - 1 - i} min ago`}: ${fmt(p)}</title></rect>`).join('');
  const last = history[n - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${name} over the last ${n} minutes: low ${fmt(Math.min(...history))}, high ${fmt(Math.max(...history))}, now ${fmt(last)}">
    <line x1="0" x2="${W}" y1="${y(fair).toFixed(1)}" y2="${y(fair).toFixed(1)}" class="spark-fair"/>
    <polyline points="${points}" class="spark-line"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3.5" class="spark-dot"/>
    ${hits}
  </svg>`;
}

function marketPanel(s) {
  const r = rankIndex(s);
  let html = `<h2>Market</h2><p class="hint">Buy precious metals and sell them when the price is right. Prices drift around a fair value and jump on news.
    You buy ${pct(MARKET.spread)} above and sell ${pct(MARKET.spread)} below the market price. Bars sit in a safe deposit box: no raider or cop can touch them.</p>`;
  for (const n of s.market.news) {
    html += `<div class="banner info"><span><b>${METALS.find((m) => m.id === n.metal).name}:</b> ${n.text}</span></div>`;
  }
  html += '<div class="grid">';
  for (const m of METALS) {
    const locked = m.rank > r;
    const price = s.market.prices[m.id];
    const history = s.market.history[m.id];
    const hourAgo = history[Math.max(0, history.length - 61)];
    const change = price / hourAgo - 1;
    const owned = s.metals[m.id] ?? 0;
    const basis = s.metalCost[m.id] ?? 0;
    const value = owned * metalSellPrice(s, m.id);
    const pl = value - basis;
    const max = maxBars(s, m.id);
    const arrow = change >= 0 ? '▲' : '▼';
    html += `<div class="card ${locked ? 'locked' : owned ? 'owned' : ''}">
      ${head(m.icon, m.name)}
      ${row('Price', `${fmt(price)} <span class="${change >= 0 ? 'chance-good' : 'chance-bad'}">${arrow} ${Math.abs(change * 100).toFixed(1)}%</span>`)}
      ${sparkline(history, m.fair, m.name)}
      ${row('Fair value', `≈ ${fmt(m.fair)}`)}
      ${row('Buy / sell', `${fmt(metalBuyPrice(s, m.id))} / ${fmt(metalSellPrice(s, m.id))}`)}
      ${owned ? row('You own', `${owned} bar${owned > 1 ? 's' : ''} · ${fmt(value)}`) : ''}
      ${owned ? row('Paid on average', fmt(basis / owned)) : ''}
      ${owned ? row(pl >= 0 ? 'Profit' : 'Loss', `${pl >= 0 ? '▲' : '▼'} ${fmt(Math.abs(pl))}`, pl >= 0 ? 'chance-good' : 'chance-bad') : ''}
      ${locked ? row('Requires', RANKS[m.rank].name) : ''}
      <div class="trade">
        ${btn('buy-metal', 'Buy 1', { id: `${m.id}:1`, disabled: locked || max < 1 })}
        ${btn('buy-metal', 'Buy 10', { id: `${m.id}:10`, disabled: locked || max < 10 })}
        ${btn('buy-metal', 'Max', { id: `${m.id}:${max}`, disabled: locked || max < 1 }).replace('<button', `<button title="Buy ${max} bars"`)}
      </div>
      <div class="trade">
        ${btn('sell-metal', 'Sell 1', { id: `${m.id}:1`, cls: 'ghost', disabled: owned < 1 })}
        ${btn('sell-metal', 'Sell 10', { id: `${m.id}:10`, cls: 'ghost', disabled: owned < 10 })}
        ${btn('sell-metal', 'Sell all', { id: `${m.id}:${owned}`, cls: 'ghost', disabled: owned < 1 })}
      </div>
    </div>`;
  }
  return html + '</div>';
}

function rivalsPanel(s, now, ui) {
  const r = rankIndex(s);
  const raider = activeRaider(s);
  const jailed = inJail(s, now);
  let html = `<h2>Rivals</h2><p class="hint">Hit rival gangs to take their money and respect. Wipe out all three to rule the town.
    Your power <b>${power(s)}</b>, defense <b>${defense(s)}</b>.</p>`;
  html += jailBanner(s, now);
  html += raider
    ? `<div class="banner info"><span>${raider.name} are eyeing your cash. Next raid in about ${secs(s.raidIn)}. Your chance to repel it: <b>${pct(raidOdds(s, raider))}</b>.</span></div>`
    : '';
  html += '<div class="grid">';
  for (const g of RIVALS) {
    const st = rivalState(s, g.id);
    const locked = g.rank > r;
    const odds = fightOdds(s, g);
    const working = ui.working === g.id;
    html += `<div class="card ${locked ? 'locked' : st.defeated ? 'owned' : ''} ${working ? 'working' : ''}">
      ${head(g.icon, g.name, 'var(--bad)')}
      ${row('Boss', g.boss)}
      ${row('Power', g.power)}
      ${row('Strength', `${st.hp} / ${g.hp}`)}
      ${bar(st.hp, g.hp, 'var(--bad)')}
      ${row('Your odds', pct(odds), chanceClass(odds))}
      ${row('Loot per win', `${fmt(g.loot[0])} – ${fmt(g.loot[1])}`)}
      ${locked ? row('Requires', RANKS[g.rank].name) : ''}
      ${st.defeated ? '<div class="row"><b>Defeated</b></div>'
        : btn('attack', `Attack · ${ATTACK_NERVE} nerve`, { id: g.id, disabled: locked || jailed || s.nerve < ATTACK_NERVE || !!ui.working })}
    </div>`;
  }
  return html + '</div>';
}

function statsPanel(s) {
  const st = s.stats;
  const beaten = RIVALS.filter((g) => rivalState(s, g.id).defeated).length;
  const goals = [
    [`All rival gangs wiped out (${beaten}/${RIVALS.length})`, beaten === RIVALS.length],
    [`${GODFATHER.respect.toLocaleString('en-US')} respect`, s.respect >= GODFATHER.respect],
    [`${fmt(GODFATHER.netWorth)} net worth (now ${fmt(netWorth(s))})`, netWorth(s) >= GODFATHER.netWorth],
  ];
  const hours = (st.playMs / 3_600_000).toFixed(1);
  return `<h2>Stats</h2>
    <h3>Road to Godfather</h3>
    <ul class="checklist">${goals.map(([t, done]) => `<li class="${done ? 'done' : ''}">${t}</li>`).join('')}</ul>
    <h3>Record</h3>
    <div class="card">
      ${row('Net worth', fmt(netWorth(s)))}
      ${row('Total earned', fmt(st.earned))}
      ${row('Jobs (successful)', `${st.missions} (${st.successes})`)}
      ${row('Arrests', st.arrests)}
      ${row('Raids repelled / suffered', `${st.raidsRepelled} / ${st.raidsSuffered}`)}
      ${row('Time played', `${hours} h`)}
    </div>
    <h3>Perks (all sources, capped)</h3>
    <div class="card">
      ${row('Nerve regen', `+${pct(perk(s, 'nerveRegen'))} (max +${pct(PERK_CAPS.nerveRegen)})`)}
      ${row('Max nerve', `+${perk(s, 'nerveMax')} (max +${PERK_CAPS.nerveMax})`)}
      ${row('Heat decay', `${heatDecayRate(s).toFixed(2)}× (max ${1 + PERK_CAPS.heatDecay}×)`)}
      ${row('Job heat', `−${pct(perk(s, 'heatReduction'))} (max −${pct(PERK_CAPS.heatReduction)})`)}
      ${row('Job nerve', `−${pct(perk(s, 'nerveCost'))} (max −${pct(PERK_CAPS.nerveCost)})`)}
    </div>
    <h3>Danger zone</h3>
    ${btn('reset', 'Start a new game', { cls: 'danger' })}
    <p class="hint" style="margin-top:20px">Icons by Lorc, Delapouite, Skoll, John Colburn, DarkZaitzev and Caro Asercion from
      <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>, licensed
      <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>.</p>`;
}

export function renderPanel(s, now, ui) {
  switch (ui.tab) {
    case 'skills': return skillsPanel(s);
    case 'arsenal': return arsenalPanel(s);
    case 'vault': return vaultPanel(s);
    case 'business': return businessPanel(s);
    case 'market': return marketPanel(s);
    case 'rivals': return rivalsPanel(s, now, ui);
    case 'stats': return statsPanel(s);
    default: return jobsPanel(s, now, ui);
  }
}

export function renderLog(s) {
  const items = s.log.map((e) => {
    const t = new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<p class="${e.kind}"><time>${t}</time>${e.text}</p>`;
  }).join('');
  return `<h3>Street news</h3>${items || '<p>Nothing yet. Time to get your hands dirty.</p>'}`;
}

export function awayModal(summary) {
  const hours = summary.elapsed / 3_600_000;
  const away = hours >= 1 ? `${hours.toFixed(1)} hours` : `${Math.round(summary.elapsed / 60_000)} minutes`;
  const lines = [];
  if (summary.income) lines.push(`Your businesses made <b>${fmt(summary.income)}</b>${hours > 2 ? ' (capped at 2 hours)' : ''}.`);
  if (summary.interest) lines.push(`Your vault earned <b>${fmt(summary.interest)}</b> in interest.`);
  if (summary.raid === 'lost') lines.push(`Rivals raided you and stole <b>${fmt(summary.stolen)}</b> of your cash on hand.`);
  if (summary.raid === 'repelled') lines.push('Rivals tried to raid you, but your crew drove them off.');
  if (!lines.length) lines.push('The streets were quiet.');
  return `<div><h2>Welcome back</h2><p>You were away for ${away}.</p>${lines.map((l) => `<p>${l}</p>`).join('')}
    ${btn('close-modal', 'Back to work')}</div>`;
}

export function winModal(s) {
  return `<div><h2>You are the Godfather</h2>
    <p>Every gang is gone, every cop is paid, and the whole town knows your name.</p>
    <p>Net worth <b>${fmt(netWorth(s))}</b> · Respect <b>${Math.floor(s.respect).toLocaleString('en-US')}</b> · Time played <b>${(s.stats.playMs / 3_600_000).toFixed(1)} h</b></p>
    ${btn('close-modal', 'Keep ruling')}</div>`;
}
