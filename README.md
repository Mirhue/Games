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
- **Skills:** four branches, each with leveled skills. Level 1 of a skill unlocks the next one in its branch, and every skill can keep leveling up to its maximum. Each level costs 1.6× the one before.
  - **Stealth:** better odds on stealth jobs, less heat.
  - **Muscle:** better odds on muscle jobs, more power and defense.
  - **Brains:** better odds on brains jobs, higher payouts, more business income, cheaper bail, more max nerve.
  - **Street Life:** faster nerve regeneration (Stamina), faster heat decay (Cool Head), and more max nerve (Second Wind).
- **Arsenal:** 7 weapons, from brass knuckles to a rocket launcher. Every copy you buy arms another crew member and adds its power to your power and defense. Each copy costs 25% more than the last. Your best weapon type boosts muscle jobs.
  - Some weapons have perks: the switchblade and silenced pistol mean less heat from jobs, the shotgun and assault rifle give more max nerve, and the tommy gun gives faster nerve regeneration.
- **Vault:** 5 tiers, from a shoebox to a Swiss vault. Money in the vault is safe from raids and police seizure. Higher tiers charge a deposit fee but pay interest.
- **Business:** 9 businesses that earn money every minute. You can buy more than one of each, and every copy costs 15% more than the last. They keep earning while you're away, for up to 2 hours.
  - Five have perks but earn about half as much: the laundromat, casino and law firm make heat drop faster (the law firm the most, and it also cuts bail), the boxing gym gives more max nerve, and the pharmacy speeds up nerve regeneration.
- **Perk caps:** perks from skills, weapons and businesses all add up, but the total is capped. Nerve regenerates at most 2× as fast, heat decays at most 3× as fast, jobs give at least 25% of their heat, and max nerve goes up by at most +150. The Stats tab shows your totals.
- **Rivals:** three gangs. The strongest one you've unlocked raids your cash on hand every 10–20 minutes of play. Attack them to take loot and respect, and wipe them out for good.
- **Winning:** beat all three gangs, reach 150,000 respect and a $500M net worth. Net worth counts cash, the vault, and what you paid for your businesses and weapons. You can keep playing afterwards.

## Development

```bash
npm test          # unit tests (Node 22+, built-in test runner)
npm run sim       # balance simulation: node tools/sim.js [hours] [seeds] [style]
```

| Path | What it is |
|---|---|
| `js/data.js` | All content and tuning numbers. Balance changes go here. |
| `js/engine.js` | Pure game rules. Randomness and time are passed in, so everything is testable. |
| `js/state.js` | New game, save/load, and save migration |
| `js/ui.js`, `js/main.js` | Rendering, the game loop, and input |
| `tools/sim.js` | Bots that play the real engine and report pacing |
| `assets/icons/` | Icons from game-icons.net (CC BY 3.0, see `CREDITS.md`) |
| `docs/superpowers/` | Design spec and implementation plan |

The simulation runs five bot styles: balanced, weapons-first, businesses-first, nerve/heat-perks-first, and a rival rusher. Current results (5 seeds, active play only):
- **Balanced:** Thief after about 10 minutes, each later rank about 1.6–2.5× slower, Kingpin after about 3.2 hours, Godfather after about 9 hours.
- **Other styles:** none of them reaches Godfather more than 15% faster than the balanced bot, so no single option is overpowered. The rival rush is 8% faster; businesses-first is 16% slower, nerve-perks-first 21% slower, and weapons-first 30% slower.
- **Old saves:** a save from before the skill levels existed is reset to an empty skill tree, and every skill point spent is refunded to re-spend.

## Credits

Icons by Lorc, Delapouite, Skoll, John Colburn, DarkZaitzev and Caro Asercion from [game-icons.net](https://game-icons.net), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).

## Ideas / not done

- Sound and animations
- A crew or henchmen system
- Random events, such as a police crackdown or a market boom
