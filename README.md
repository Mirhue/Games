# Kingpin

A single-player browser game. You arrive in town with empty pockets and work your way up from **Street Rat** to **Godfather**, the wealthiest and most feared gangster in town.

**Status:** playable. All systems from the spec are in, and pacing is tuned with the balance simulation.

## How to run it

```bash
python3 -m http.server 8766    # or: npm run serve
# open http://localhost:8766
```

There's no build step and no dependencies. The game saves itself in the browser's localStorage under `kingpin.save`.

## How it plays

- **Jobs:** 6 tiers × 3 jobs (stealth, muscle, brains). They cost **nerve**, which refills 1 point every 6 s. A success pays cash, **respect** and **skill points**. Respect raises your rank, and each rank unlocks the next tier.
- **Police:** every job adds **heat**. Heat lowers your success chance and raises your chance of arrest. If you're arrested, the police seize 25% of your cash on hand and you sit in jail for 20 s per tier, or pay bail. You can bribe the cops to wipe your heat.
- **Skills:** three branches of 5 nodes each.
  - **Stealth:** better odds on stealth jobs, less heat.
  - **Muscle:** better odds on muscle jobs, more power and defense.
  - **Brains:** better odds on brains jobs, higher payouts, more business income, cheaper bail, more max nerve.
- **Arsenal:** 7 weapons, from brass knuckles to a rocket launcher. Your best weapon boosts muscle jobs and counts in every fight.
- **Vault:** 5 tiers, from a shoebox to a Swiss vault. Money in the vault is safe from raids and police seizure. Higher tiers charge a deposit fee but pay interest.
- **Business:** 6 businesses that earn money every minute. You can buy more than one of each, and every copy costs 15% more than the last. They keep earning while you're away, for up to 2 hours. The laundromat and casino also make your heat drop faster.
- **Rivals:** three gangs. The strongest one you've unlocked raids your cash on hand every 10–20 minutes of play. Attack them to take loot and respect, and wipe them out for good.
- **Winning:** beat all three gangs, reach 150,000 respect and a $500M net worth. You can keep playing afterwards.

## Development

```bash
npm test          # unit tests (Node 22+, built-in test runner)
npm run sim       # balance simulation: node tools/sim.js [hours] [seeds]
```

| Path | What it is |
|---|---|
| `js/data.js` | All content and tuning numbers. Balance changes go here. |
| `js/engine.js` | Pure game rules. Randomness and time are passed in, so everything is testable. |
| `js/state.js` | New game, save/load, and save migration |
| `js/ui.js`, `js/main.js` | Rendering, the game loop, and input |
| `tools/sim.js` | A greedy bot that plays the real engine and reports pacing |
| `docs/superpowers/` | Design spec and implementation plan |

The current simulation results (5 seeds, active play only):
- Thief after about 10 minutes.
- Each later rank takes about 1.6–1.9× longer than the one before.
- Kingpin after about 3.7 hours.
- Godfather after about 9 hours.

## Ideas / not done

- Sound and animations
- A crew or henchmen system
- Random events, such as a police crackdown or a market boom
