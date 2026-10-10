// Startup, game loop, saving, and turning clicks into engine actions.
import { newState, serialize, deserialize, SAVE_KEY } from './state.js';
import {
  tick, applyOffline, doMission, payBail, bribeCops, buySkill, buyWeapon, upgradeVault,
  deposit, withdraw, buyInvestment, attackRival, resolveRaid, activeRaider, addLog,
} from './engine.js';
import { renderTopbar, renderTabs, renderPanel, renderLog, awayModal, winModal } from './ui.js';

const WORK_MS = 1000;          // "working…" delay before a job resolves
const AWAY_GAP_MS = 60_000;    // a gap this long counts as time away (sleep, background tab)
const SAVE_EVERY_MS = 5000;

const $ = (id) => document.getElementById(id);
const ui = { tab: 'jobs', working: null };
let state = loadGame();
let lastSave = 0;

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
  const tabs = renderTabs(ui.tab, state);
  if (tabs !== render.tabs) $('tabs').innerHTML = render.tabs = tabs;
  // Don't re-render the panel while the player is typing an amount.
  // Only touch the DOM when something changed, so clicks aren't swallowed by a redraw.
  const typing = $('panel').contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
  const panel = renderPanel(state, now, ui);
  if (!typing && panel !== render.panel) $('panel').innerHTML = render.panel = panel;
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
    showModal(awayModal(away.summary));
  } else {
    state = tick(state, now);
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGame();
  } else {
    catchUp();
    render();
  }
});
window.addEventListener('pagehide', saveGame);

catchUp();
render();
setInterval(() => {
  catchUp();
  if (Date.now() - lastSave >= SAVE_EVERY_MS) saveGame();
  render();
}, 1000);
