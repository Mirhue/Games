// Startup, game loop, saving, and turning clicks into engine actions.
import { newState, serialize, deserialize, SAVE_KEY } from './state.js';
import {
  tick, applyOffline, doMission, payBail, bribeCops, buySkill, buyWeapon, upgradeVault,
  deposit, withdraw, buyInvestment, attackRival, resolveRaid, activeRaider, addLog,
  marketTick, buyMetal, sellMetal,
} from './engine.js';
import { renderTopbar, renderTabs, renderPanel, renderLog, awayModal, winModal } from './ui.js';

const WORK_MS = 1000;          // "working…" delay before a job resolves
const AWAY_GAP_MS = 60_000;    // a gap this long counts as time away (sleep, background tab)
const SAVE_EVERY_MS = 5000;

const $ = (id) => document.getElementById(id);
const ui = { tab: 'jobs', working: null };
let state = loadGame();
let lastSave = 0;
let pointerHeld = false;
let chartHovered = false;   // keep price charts still so their tooltips can be read

function loadGame() {
  const now = Date.now();
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { /* storage blocked */ }
  const loaded = deserialize(raw);
  if (loaded) return loaded;
  const fresh = newState(now);
  const note = raw ? 'Your old save was damaged, so a new game was started.' : 'You arrive in town with empty pockets and big dreams.';
  addLog(fresh, [{ kind: 'info', text: note }], now);
  return fresh;
}

function saveGame() {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch { /* storage full or blocked */ }
  lastSave = Date.now();
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function showModal(html) {
  $('modal').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function render() {
  const now = Date.now();
  $('topbar').innerHTML = renderTopbar(state, now);
  // Never swap out buttons while a mouse button or finger is down: the click
  // would land on a detached element and be lost. Also leave the panel alone
  // while the player is typing an amount.
  if (pointerHeld) return;
  const tabs = renderTabs(ui.tab, state);
  if (tabs !== render.tabs) $('tabs').innerHTML = render.tabs = tabs;
  const typing = $('panel').contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
  const panel = renderPanel(state, now, ui);
  if (!typing && !chartHovered && panel !== render.panel) $('panel').innerHTML = render.panel = panel;
  const log = renderLog(state);
  if (log !== render.log) $('log').innerHTML = render.log = log;
}

// Applies an engine result: keeps the new state, shows a toast for refusals.
function apply(result) {
  state = result.state;
  if (!result.ok && result.events[0]) toast(result.events[0].text);
  if (state.won && !state.winShown) {
    state.winShown = true;
    showModal(winModal(state));
  }
  saveGame();
  render();
}

function catchUp() {
  const now = Date.now();
  if (now - state.lastTick > AWAY_GAP_MS) {
    const away = applyOffline(state, now, Math.random);
    state = away.state;
    if (away.summary.notable) showModal(awayModal(away.summary));
  } else {
    state = tick(state, now);
    state = marketTick(state, now, Math.random);
  }
  if (state.raidIn <= 0 && activeRaider(state)) {
    const raid = resolveRaid(state, Math.random, now);
    toast(raid.events[0].text);
    state = raid.state;
  }
  if (state.won && !state.winShown) {
    state.winShown = true;
    showModal(winModal(state));
  }
}

const vaultAmount = () => Math.floor(Number($('vault-amount')?.value) || 0);

const actions = {
  tab: (id) => { ui.tab = id; render(); },
  job: (id) => {
    if (ui.working) return;
    ui.working = id;
    render();
    setTimeout(() => {
      ui.working = null;
      const r = doMission(state, id, Math.random, Date.now());
      if (r.ok) toast(r.events[0].text);
      apply(r);
    }, WORK_MS);
  },
  attack: (id) => {
    if (ui.working) return;
    ui.working = id;
    render();
    setTimeout(() => {
      ui.working = null;
      const r = attackRival(state, id, Math.random, Date.now());
      if (r.ok) toast(r.events[0].text);
      apply(r);
    }, WORK_MS);
  },
  bail: () => apply(payBail(state, Date.now())),
  bribe: () => apply(bribeCops(state, Date.now())),
  skill: (id) => apply(buySkill(state, id, Date.now())),
  weapon: (id) => apply(buyWeapon(state, id, Date.now())),
  invest: (id) => apply(buyInvestment(state, id, Date.now())),
  'vault-upgrade': () => apply(upgradeVault(state, Date.now())),
  deposit: () => apply(deposit(state, vaultAmount(), Date.now())),
  withdraw: () => apply(withdraw(state, vaultAmount(), Date.now())),
  'deposit-all': () => apply(deposit(state, state.cash, Date.now())),
  'withdraw-all': () => apply(withdraw(state, state.vault.balance, Date.now())),
  'buy-metal': (id) => { const [metal, qty] = id.split(':'); apply(buyMetal(state, metal, Number(qty), Date.now())); },
  'sell-metal': (id) => { const [metal, qty] = id.split(':'); apply(sellMetal(state, metal, Number(qty), Date.now())); },
  'close-modal': () => $('modal').classList.add('hidden'),
  reset: () => {
    if (!confirm('Start over? Your current gangster will be gone for good.')) return;
    state = newState(Date.now());
    addLog(state, [{ kind: 'info', text: 'A new face arrives in town.' }], Date.now());
    saveGame();
    render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el.dataset.id);
});

document.addEventListener('pointerdown', () => { pointerHeld = true; });
document.addEventListener('pointerover', (e) => { chartHovered = !!e.target.closest?.('.spark'); });
document.addEventListener('pointerout', (e) => {
  if (e.target.closest?.('.spark') && !e.relatedTarget?.closest?.('.spark')) { chartHovered = false; render(); }
});
// The click event fires right after pointerup, so redraw only after it.
const release = () => { pointerHeld = false; setTimeout(render, 0); };
document.addEventListener('pointerup', release);
document.addEventListener('pointercancel', release);
window.addEventListener('blur', release);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGame();
  } else {
    catchUp();
    render();
  }
});
window.addEventListener('pagehide', saveGame);

try {
  catchUp();
} catch (err) {
  console.error('Could not resume the saved game', err);
  state = newState(Date.now());
  addLog(state, [{ kind: 'info', text: 'Your old save could not be loaded, so a new game was started.' }], Date.now());
}
render();
setInterval(() => {
  // A hidden tab is time away, not play: the visibilitychange handler catches
  // up (with the offline cap) when the player comes back.
  if (document.hidden) return;
  catchUp();
  if (Date.now() - lastSave >= SAVE_EVERY_MS) saveGame();
  render();
}, 1000);
