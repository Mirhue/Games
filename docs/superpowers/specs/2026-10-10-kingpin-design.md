# Kingpin — Design Spec

Date: 2026-10-10 · Branch: `game/kingpin`

## 1. Intent

A single-player browser game in English. You start as a petty thief and work your way up to become the wealthiest, most feared gangster in town (the **Godfather**). It takes inspiration from Banditi.nl but plays faster: no long waits, and every 5–15 minute session shows visible progress. A full run spans several sessions or days, about 8–12 hours of active play. After winning, you can keep playing.

**Success criteria**
- Every system the user asked for exists, with tiers: missions, weapons, skills, investments, savings, police, attackers.
- The simulation script shows pacing within the targets in §8.
- All game rules are covered by unit tests. The game runs in a browser with no build step.

**Non-goals (YAGNI):** multiplayer, accounts, a backend, sound, mobile apps, translations, and multiple save slots.

## 2. Architecture

The game is plain HTML/CSS/JS using ES modules, with no build step and no runtime dependencies. You play it by serving the folder (`python3 -m http.server 8766`) and opening `http://localhost:8766`.

| File | Responsibility |
|---|---|
| `index.html`, `css/style.css` | Page shell and styling (dark "noir" theme, works on narrow screens) |
| `js/data.js` | All content and tuning numbers (missions, ranks, skills, weapons, vaults, investments, rivals, constants). No logic. |
| `js/engine.js` | Pure game rules. Every function takes `(state, …, rng, now)` and returns `{state, events}`. It never touches the DOM, `Math.random`, or `Date.now`. |
| `js/state.js` | `newState(now)`, `save(state)` / `load()` to localStorage (key `kingpin.save`), and `version` + `migrate()` |
| `js/ui.js` | Renders the state into the DOM and turns clicks into engine calls |
| `js/main.js` | Startup: load or create the state, apply offline progress, run a 1-second tick loop, autosave every 5 s and on `visibilitychange` |
| `tests/*.test.js` | `node --test` unit tests for the engine and state |
| `tools/sim.js` | Headless bot playthrough that prints a pacing report |

Node (LTS) is used only for tests and the simulation.

`rng` is a function that returns numbers in [0,1). Tests pass a seeded or scripted rng. The UI passes `Math.random`. `now` is in milliseconds.

## 3. State

```
{ version, createdAt, lastTick,
  cash, respect, sp, nerve, heat,
  jailUntil,                 // ms timestamp or 0
  skills: { [skillId]: true },
  weapons: { [weaponId]: true },   // the best owned weapon counts
  vault: { tier, balance },        // tier 0 = none
  investments: { [invId]: count },
  rivals: { [rivalId]: { hp, defeated } },
  nextRaidAt,                // ms, counts only time spent playing
  stats: { missions, successes, arrests, raidsSuffered, raidsRepelled, earned },
  won, log: [ {t, text, kind} ] }   // log keeps the last 50 entries
```

Derived values (computed by the engine, not stored): rank, nerveMax, power, defense, net worth, success chances, income per minute.

## 4. Core loop

- **Nerve:** max 100 (+skills), regenerates 1 per 6 s. Each mission costs nerve.
- **Missions** resolve immediately. The UI shows a 1-second "working…" animation before revealing the result.
- **Jail** blocks missions and attacks. Shopping, the vault, skills and investments still work.
- **The tick** (every 1 s, plus a catch-up on load) handles nerve regen, heat decay, investment income, and the raid timer.

## 5. Content tiers

### 5.1 Ranks (by Respect)
Street Rat (0) → Thief → Hustler → Enforcer → Boss → Kingpin → Godfather (requires the win condition). Each rank unlocks the mission tier with the same number. Thresholds are in `data.js` and tuned by the simulation.

### 5.2 Missions (6 tiers × 3)
Each mission has: `id, name, tier, type (stealth|muscle|brains), nerve, baseChance, cash [min,max], respect, sp, heat`.

| Tier | Stealth | Muscle | Brains |
|---|---|---|---|
| 1 | Pickpocket | Shoplift by force (snatch & run) | Steal a bike |
| 2 | Car break-in | Mug a tourist | Burglarize a house |
| 3 | Steal a car | Rob a corner store | Run a protection racket |
| 4 | Jewelry store heist | Hijack a truck | Extort a businessman |
| 5 | Casino vault job | Bank robbery | Arms deal |
| 6 | Federal reserve heist | Take over rival turf | Bribe the mayor |

**Success chance** = `clamp(baseChance + skillBonus(type) + weaponBonus(if muscle) − heat × 0.003, 0.05, 0.95)`.

**On success:** cash = rand(min, max) × (1 + payout bonus), plus respect, sp, and heat × (1 − heat reduction).

**On failure:** you still pay the nerve and get half the heat. You are arrested with probability `arrestBase(tier) + heat × 0.004` (arrestBase rises from 0.15 to 0.35 by tier). Otherwise you "got away empty-handed".

**Arrest:** jail for `20 s × tier`. The police seize 25% of cash on hand. Bail = `max(100, 10% of net worth) × (1 − bail discount)`. Paying bail releases you immediately.

### 5.3 Heat
0–100. It decays by 1 every 10 s, faster with the laundromat or casino. **Bribe the cops:** pay `heat × costPerHeat(rank)` to set heat to 0.

### 5.4 Skill tree (3 branches × 5 nodes, bought in order)
- **Stealth:** +success on stealth missions (+4% per node) and −heat gained (−8% per node).
- **Muscle:** +success on muscle missions (+4%), plus combat power and defense.
- **Brains:** +success on brains missions (+4%), more payout (+5%), investment income (+10%), bail discount, and nerve max (+10 on nodes 2 and 4).

Costs rise per node (for example 1, 3, 6, 10, 15 SP; tuned by the simulation).

### 5.5 Weapons (7 tiers)
Brass knuckles, knife, pistol, shotgun, SMG, assault rifle, RPG. Each has `price, power, rankRequired`. Only the best weapon you own counts.
- Its power feeds muscle mission success: `weaponBonus = power × k`, capped at +20%.
- It also adds to combat power and raid defense.

### 5.6 Savings / vault (5 tiers)
| Tier | Name | Capacity | Deposit fee | Interest |
|---|---|---|---|---|
| 1 | Shoebox | small | 0% | 0 |
| 2 | Safehouse | ×10 | 0% | 0 |
| 3 | Bank account | ×10 | 2% | small, per hour |
| 4 | Offshore account | ×10 | 3% | higher |
| 5 | Swiss vault | ×10 | 5% | highest |

- Upgrading costs cash.
- Interest accrues per tick (it counts toward the offline cap) and never pushes the balance above capacity.
- Withdrawals are free. Money in the vault is immune to raids and police seizure.

### 5.7 Investments (6 tiers)
Corner hustle, laundromat, bar, nightclub, casino, shipping company. Each has `basePrice, incomePerMin, rankRequired`, and the laundromat and casino also have `heatDecayBonus`.
- You can buy more than one: the price of the n-th copy is `basePrice × 1.15^n`.
- Income goes to cash on hand.

### 5.8 Rival gangs (3)
The Rats (weak), Los Cuervos (medium), and the Volkov Bratva (strong). Each has `power, hp, loot, respectReward, rankRequired`.
- **Attack:** costs 20 nerve. Win chance = `you/(you + them)`, clamped between 5% and 95%, where *you* = your combat power and *them* = their power.
  - A win deals damage and pays loot and respect.
  - When their hp reaches 0, they are defeated permanently, with a big respect reward.
  - A loss adds heat and has a chance of losing cash.
- **Raids:** the strongest undefeated rival you've unlocked raids you every 10–20 minutes of playtime. Raids are suspended while you're in jail. Repel chance = `defense/(defense + rival.power)`.
  - On a failed defense, you lose 10–30% of cash on hand. On success, you gain respect.
  - Raids never touch the vault.

### 5.9 Win condition
You become **Godfather** when all 3 rivals are defeated, Respect ≥ the Godfather threshold, and net worth ≥ the Godfather wealth threshold. A win screen shows your stats, and you can keep playing.

## 6. Offline progress
On load, the engine compares `now − lastTick` with `elapsed`:
- Nerve regen, heat decay and jail time all use the full `elapsed`.
- Investment income and vault interest are capped at 2 h.
- If `elapsed > 5 min` and you have cash on hand, one raid check runs.
- A "While you were away…" summary shows what happened.

## 7. UI
The layout is a single page:
- **Top bar:** cash, vault, nerve bar, heat bar, rank and respect progress, SP.
- **Tabs:** Missions, Skills, Arsenal (weapons), Vault, Business (investments), Rivals, Stats.
- **Right side or bottom:** the event log.

Every mission card shows its success %, nerve, payout range and heat. Locked content is shown greyed out, with the rank it needs. A jail overlay shows a countdown and a bail button.

## 8. Balance
**Targets** (measured by `tools/sim.js`, which plays greedily for the best expected value per nerve, buys upgrades when affordable, and banks spare cash):
- Tier 2 unlocks at about 10 minutes of active play.
- Each later rank takes about 1.7× longer than the one before.
- Godfather after about 8–12 hours of active play.
- No stretch longer than 20 minutes without an affordable upgrade or unlock.

**Rules of thumb:**
- Mission cash grows about 7× per tier.
- The next useful purchase costs about 10–20 minutes of earnings at your current tier.
- Higher tiers have a better expected value per nerve, but more variance and heat.

## 9. Testing
- Unit tests for success-chance math, mission outcomes (with a scripted rng), arrest and jail, bail, heat decay, skill prerequisites, weapon and vault and investment purchase rules, vault capacity and fees and interest, raids (vault protection), rival defeat, the win condition, the offline cap, and save/load/migrate round-trips.
- The simulation report is checked against §8.
- Manual browser playtest.

## 10. Delivery stages (one commit each)
1. Spec
2. Plan
3. Scaffold
4. Missions + nerve
5. Police / heat / jail
6. Skills
7. Weapons
8. Vault
9. Investments + offline
10. Rivals + raids + win
11. UI polish
12. Balance pass
