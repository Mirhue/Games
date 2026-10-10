# Kingpin v2 — Icons, crew weapons, leveled skills, perk businesses

Date: 2026-10-10 · Branch: `game/kingpin` · Builds on `2026-10-10-kingpin-design.md` (still binding where not changed here)

## 1. Intent
The user asked for:
- pictures for missions, weapons and skills;
- weapons that can be bought several times, each copy adding power;
- skills with levels, where level 1 of a node unlocks the next, more expensive node while the node itself can keep being upgraded;
- a skill that increases nerve gained and one that lowers heat per second;
- businesses and weapons that help with nerve or heat;
- balance, so that no single option is overpowered.

The user chose: game-icons.net icons, and the "arm your crew" model (copies stack).

**Success criteria**
- Every user request above is implemented.
- Old saves load (save version 2 migration).
- All tests pass.
- Balance targets (§7) are met in the simulation.

## 2. Icons
- About 60 SVGs from game-icons.net (CC BY 3.0) are stored in `assets/icons/<id>.svg`.
- Content entries get an `icon` field.
- The UI draws icons as a CSS mask, so they take a theme colour:
  - missions use their type colour (stealth / muscle / brains);
  - weapons, skills, businesses and rivals use gold.
- Credits go in the README and the Stats tab: "Icons by Lorc, Delapouite, Skoll, John Colburn, DarkZaitzev, Caro Asercion and contributors — game-icons.net, CC BY 3.0".

## 3. Unified perks
One function, `effect(state, key)`, sums a perk across three sources:
- skill levels × the per-level effect;
- weapon copies × the per-copy perk;
- business copies × the per-copy perk.

Caps are applied where each value is used:

| Key | Meaning | Cap (all sources together) |
|---|---|---|
| `nerveRegen` | Nerve regenerates faster: interval = 6 s / (1 + bonus) | +100% (2×) |
| `heatDecay` | Heat decays faster per second | +200% (3×), as before |
| `heatReduction` | Less heat gained per job | 75% |
| `nerveMax` | Extra max nerve | +150 |
| `stealthChance` / `muscleChance` / `brainsChance`, `payoutBonus`, `incomeBonus`, `bailDiscount`, `power`, `defense` | As in v1 | Success chance is still clamped to [0.05, 0.95]; bail discount ≤ 90% |

## 4. Weapons — arm your crew
- `state.weapons[id]` is a count of copies.
- The n-th copy costs `price × 1.25^n` (n starts at 0). There is no limit on copies, but each needs the weapon's rank.
- Every copy adds its `power` to both power and defense.
- The success bonus on muscle jobs still comes only from the best weapon type owned (unchanged, capped at 20%).
- Perks per copy:

| Weapon | Perk per copy |
|---|---|
| Brass knuckles | — |
| Switchblade | heatReduction 0.02 |
| Silenced pistol | heatReduction 0.03 |
| Sawed-off shotgun | nerveMax 3 |
| Tommy gun | nerveRegen 0.04 |
| Assault rifle | nerveMax 5 |
| Rocket launcher | — |

## 5. Skills — leveled tree
- `state.skills[id]` is a level number.
- **Unlocking:** a node is unlocked when its predecessor in the same branch has level ≥ 1. Node 1 is always unlocked.
- **Levels:** each node has a `maxLevel`: 5 for nodes 1–3, 3 for node 4, 1 for node 5.
- **Cost:** going from level L−1 to level L costs `round(baseCost × 1.6^(L−1))`.
- **Effects** are listed per level.
- **Branches:** Stealth, Muscle and Brains (5 nodes each, same names as in v1), plus a new branch, **Street Life**:
  1. **Stamina:** nerveRegen +6% per level, up to level 5.
  2. **Cool Head:** heatDecay +10% per level, up to level 5.
  3. **Second Wind:** nerveMax +10 per level, up to level 3.

## 6. Businesses with perks
Three businesses are added:

| Business | Rank | Perk per copy |
|---|---|---|
| Boxing gym | 1 | nerveMax +2 |
| Pharmacy | 2 | nerveRegen +3% |
| Law firm | 4 | heatDecay +10% |

- The laundromat and casino keep their heatDecay perk.
- Perk businesses earn about half the income per dollar of a pure-income business.
- The UI shows each business's perk.

## 7. Balance
**Targets**
- The balanced bot still meets v1 §8: Thief at about 10 min, Godfather at 8–12 h, and no gap longer than 20 min.
- **"Not overpowered" test:** the sim gets focus styles that spend on one category first:
  - `weapons`
  - `skills`
  - `business`
  - `rivals` (saves nerve for fights and attacks at odds of 30% or better)

  No focus style may reach Godfather more than 15% faster than the balanced bot (averaged over 5 seeds). If one does, that category is toned down.

**Fix carried over from the v1 review:** the rival rush was about 7.3 h. It now has to fall within the 15% band.

## 8. Saves
- `SAVE_VERSION = 2`.
- Migrating from v1 turns `skills {id: true}` into `{id: 1}` and `weapons {id: true}` into `{id: 1}`. All other fields are kept.
- Migration is idempotent, and v2 saves pass through unchanged. This is tested.
