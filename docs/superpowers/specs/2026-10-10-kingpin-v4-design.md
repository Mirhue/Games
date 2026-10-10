# Kingpin v4 — More enemies, street encounters, gangs that fight back, small skills

Date: 2026-10-10 · Branch: `game/kingpin` · Builds on the v1–v3 specs (still binding where not changed here).

## 1. Intent

**User request:** "make the game more interesting, have more enemies and more skills (smaller ones)". After a brainstorm, the user said "implement your recommendation". That recommendation was enemies A + B + D, plus the small-skill ideas:
- **A.** More gangs, each hurting you in its own way.
- **B.** Street encounters with fight / flee / pay.
- **D.** Gangs that grow, heal and hit back.
- **Skills:** cheap minor skills between the big ones, small skills for things nothing improved yet, and a Warfare branch.

There were no further questions: the user asked for autonomous implementation, so the design calls below are mine.

**Success criteria**
- All of the above is implemented and tested.
- v2/v3 saves load.
- Balance (sim, 5 seeds): the balanced bot reaches Godfather in 8–12 h, and no style is more than 15% faster than balanced.

## 2. Gangs (A)

Seven gangs instead of three. The win needs all seven defeated. **The Commission** can only be attacked, and only raids, once the other six are gone.

| id | Gang | Boss | Rank | Raid effect when not repelled |
|---|---|---|---|---|
| rats | The Dock Rats | Fat Tony | Hustler | Steals 10–30% of cash on hand |
| cuervos | Los Cuervos | El Cuervo | Enforcer | Tip off the cops: +30 heat |
| riders | Hell's Riders | Big Mike | Enforcer | Steal 10% of your weapon copies (at least 1, rounded up) |
| triad | Golden Dragon Triad | Madam Lin | Boss | Sabotage: your biggest-earning business type earns nothing for 10 min |
| ghostnet | Ghost Net | Zero | Boss | Hack: the vault is frozen for 10 min (no deposits, withdrawals or interest) |
| volkov | Volkov Bratva | Dmitri Volkov | Kingpin | Steals 10–30% of cash on hand |
| commission | The Commission | Don Corvino | Kingpin | Steals 10–30% of cash on hand |

- **Fallback:** if a raid has nothing to hit (no weapons, no business, no vault money), it steals cash instead.
- **Who raids:** still one raid timer (10–20 min of play), as before. When it fires, the raider is a random unlocked, undefeated gang, unless a gang is retaliating (§4).
- **What stays safe:** the vault balance and metals are never taken. The hack only freezes access.
- **Numbers** (power, hp, loot, respect, defeat SP) live in `data.js` and are tuned with the sim. Defeat SP grows from 100 for the first gang to 500 for the Commission.

## 3. Street encounters (B)

**When:** after a job at tier ≥ 2 that didn't end in an arrest, there's a 6% chance of an encounter. It shows as a popup.

**While pending:**
- jobs and attacks are refused;
- the encounter is kept in the save;
- the bot in the sim answers it straight away.

**The stake** is the job's average cash. Encounter power is `ENCOUNTER_POWER[tier − 1] × type multiplier`, with `ENCOUNTER_POWER = [15, 40, 120, 300, 700, 1500]`.

| Type | Mult | Win a fight | Lose a fight / fail to flee | Flee base | Pay |
|---|---|---|---|---|---|
| Mugger | 0.6 | +0.5 × stake cash, +job respect | lose 10% cash, +5 heat | 60% | 0.3 × stake |
| Rival crew | 1.2 | +1.0 × stake cash, +2 × job respect | lose 10% cash, +8 heat | 50% | 0.5 × stake |
| Undercover cop | 0.8 | +job respect, +15 heat | arrested: jail as for a failed job | 55% | 0.4 × stake |
| Snitch | 0.3 | +job respect, +5 heat | +25 heat | 70% | 0.25 × stake |

- **Fight odds:** your power / (your power + encounter power), plus the `fightOdds` perk, clamped to 5–95%.
- **Flee:** a successful flee does nothing.
- **Pay:** needs the cash on hand.
- **Loss cap:** a lost encounter takes at most 2 × the stake in cash (`ENCOUNTER_LOSS_CAP`). Otherwise a rich player would always pay, and the choice would stop mattering.

## 4. Gangs fight back (D)

- **Growth:** each unlocked, undefeated gang grows +10% power per hour of play, up to +50%. Winning a fight against it resets the growth.
- **Healing:** a gang that isn't beaten heals 1 hp after 20 min of play without being hit.
- **Retaliation:** after any fight against a gang that leaves it alive, it retaliates 50% of the time. Its raid comes within 1–3 min of play: the raid timer drops to that, and the gang becomes the next raider.

## 5. Skills

**New perk keys and caps (all sources together):**

| Key | Effect | Cap |
|---|---|---|
| critChance | chance a successful job pays double cash | 10% |
| jailCut | shorter jail time | 50% |
| fightOdds | added to fight odds (gangs and encounters) | +20% |
| raidOdds | added to raid-repel odds | +20% |
| raidLoss | raids hurt less: cash and heat taken, weapons stolen, sabotage and freeze length | 50% |
| gangLoot | more loot from gang fights and encounter wins | +100% |
| fleeChance | added to flee chance | +30% |
| payCut | cheaper encounter payoffs | 50% |
| bribeDiscount | cheaper bribes | 50% |
| offlineMin | extra minutes of offline income | +120 min |
| powerPct | power and defense × (1 + value) | — |

**Unlocking:** each branch is an ordered chain. A node unlocks when the node before it is at level ≥ 1. A node you already own stays upgradable even if a minor was inserted before it.

**Minor nodes:** all max level 3, placed after big node *i*. Base cost after node 1–4 is 5 / 15 / 50 / 160 (Street: 12 / 40 / 110).

| Branch | Minor after 1 | after 2 | after 3 | after 4 |
|---|---|---|---|---|
| Stealth | Quiet Steps: fleeChance .04 | Alibi: jailCut .06 | Lucky Break: critChance .01 | Vanish: heatDecay .05 |
| Muscle | Thick Neck: raidLoss .05 | Bodyguards: raidOdds .02 | Shakedown: gangLoot .06 | Brawler: fightOdds .015 |
| Brains | Bookkeeper: offlineMin 10 | Greased Palms: bribeDiscount .06 | Negotiator: payCut .1 | Accountant: incomeBonus .02 |
| Street | Deep Breath: nerveMax 3 | Night Owl: offlineMin 10 | Second Nature: critChance .01 | — |
| Warfare | Hard Target: raidLoss .05 | Grudge: gangLoot .05 | Getaway Driver: jailCut .05 | War Chest: fightOdds .015 |

**The Warfare branch** has five big nodes:

| Node | Effect per level | Max level | Base cost (SP) |
|---|---|---|---|
| Scrapper | fightOdds .02 | 5 | 3 |
| Lookouts | raidOdds .03 | 5 | 10 |
| Quick Feet | fleeChance .04 | 5 | 30 |
| Spoils of War | gangLoot .1 | 3 | 100 |
| Warlord | powerPct .25 | 1 | 350 |

That's 24 new skills, 43 in total.

## 6. UI

- **Rivals tab:** all 7 gangs, each with:
  - its raid effect;
  - current power, including growth;
  - hp, and a heal timer when damaged.

  Banners show an active sabotage, a vault freeze, and a gang that is coming for revenge.
- **Encounter modal:** the icon, the text, and three buttons showing the odds or cost. It reappears after a reload until it's answered.
- **Skills tab:** 5 branches. Minor nodes use a compact card.
- **Stats tab:** lists the new perks.
- **Vault tab:** shows a frozen banner. Its buttons are disabled while the vault is frozen.

## 7. Saves

`SAVE_VERSION` stays 2. `migrate()` fills in and repairs the new fields:
- `encounter` (null, or a valid encounter);
- `raidFrom`;
- `sabotage {invId: until}`;
- `vaultFrozenUntil`;
- per rival: `grownMs` and `quietMs`.

## 8. Balance

- **Sim:** the bots answer encounters with the best expected value and buy the new skills like any other.
- **Targets:** as in §1.
- **Tests:** the perk caps, every raid effect and its fallback, Commission gating, growth/heal/retaliation, encounter outcomes, and migration.
