# Kingpin v3 — Vault rework, metals market, nerve-saving skill

Date: 2026-10-10 · Branch: `game/kingpin` · Builds on the v1 and v2 specs (still binding where not changed here). Job mastery, outgrown jobs and skill points for defeating gangs were approved in chat and have already shipped (commits up to `660d91d`).

## 1. Intent (user requests)
1. Make the vault worth buying. A 2% deposit fee with 0.5% interest per hour only pays off after 4 hours.
2. Add a small market where precious metals can be bought and sold. Prices move like a stock market, so you can sell for more or less than you paid.
3. Add a skill that lowers the nerve used on jobs.

User choices for the market:
- Metals are **safe from raids and police**; the risk is the price.
- Prices follow **cycles plus news**: they pull back toward a fair value, have booms and crashes, and get news shocks. They make **zero profit on average**, after a buy/sell spread.
- Prices **keep moving while the game is closed**.

## 2. Vault (data change)
| Tier | Fee | Interest / h | Break-even |
|---|---|---|---|
| Shoebox | 0% | 0 | — |
| Safehouse | 0% | 0 | — |
| Bank account | 1% | 1% | 1 h |
| Offshore account | 1% | 1.5% | 40 min |
| Swiss vault | 2% | 2% | 1 h |

Capacity, prices, the interest cap and the 2 h offline cap are unchanged.

## 3. Nerve-saving skill
- A new node, Street Life 4, **Old Pro**: perk `nerveCost` −3% per level, up to level 5. It is unlocked by Second Wind level 1. Base cost 150 SP.
- `PERK_CAPS.nerveCost = 0.3`.
- `jobNerve = max(1, round(nerve × mastery cut × outgrown cut × (1 − nerveCost)))`. Attacking a rival is not a job and is not discounted.

## 4. Market
**Metals**

| Metal | Fair value per bar | Stationary volatility σ∞ |
|---|---|---|
| Silver | $500 | 0.25 |
| Gold | $20,000 | 0.15 |
| Platinum | $250,000 | 0.25 |
| Palladium | $3,000,000 | 0.40 |

Each metal also has a rank requirement for buying: silver 0, gold 1, platinum 3, palladium 4.

**Price model.** For each metal, x = ln(price / fair) follows a discrete Ornstein–Uhlenbeck process:
- Each step of `MARKET_STEP_MS = 60 s`:
  `x ← target + (x − target)·e^(−θ·dt) + σ∞·√(1 − e^(−2θ·dt))·z`
  - z is standard normal (Box–Muller from rng);
  - θ is set so the half-life is 2 h;
  - target is 0, or the active news shift.
- **News:** with probability p per step (about one event per metal every 30–60 min overall), one random metal gets a shift of ±(0.2 to 0.5) on target for 20–60 min, with a headline. One active news item per metal at most.

**Trading**
- Buy price = price × 1.02; sell price = price × 0.98. Quantities are whole bars.
- Buying needs the rank and enough cash on hand. Selling needs the bars.
- Cost basis is tracked per metal (total paid, reduced proportionally when selling) to show profit and loss.

**Where it lives in state**
- `market { prices, history (last 120 per metal), news[], lastStep }`
- `metals { id: bars }`
- `metalCost { id: dollars }`

**Safety and net worth**
- Metals are never touched by raids, seizure or fight losses.
- Net worth adds bars × sell price.

**Time.** `marketTick(state, now, rng)` advances whole steps since `lastStep`.
- If the gap is longer than 24 h, each price is re-drawn from the stationary distribution, old news is cleared and the history is reset.
- Called from the main loop (when the tab is visible), from `applyOffline`, and from the sim.

## 5. UI
- **Market tab:** a card per metal with icon, price and its change versus 1 h ago, a 2 h sparkline (inline SVG), owned bars, average cost and profit/loss.
  - Buttons: Buy 1 / 10 / Max and Sell 1 / 10 / All.
  - Rank-locked metals are greyed out.
- **News headlines** appear at the top of the tab, and new news also goes to the event log.
- The skill card for Old Pro shows like the other skills.

## 6. Balance
- **Tests** (seeded rng):
  - prices stay positive and finite;
  - the mean of ln(price/fair) over 30 days of steps is close to 0;
  - random round trips lose money on average (about the spread);
  - the long-gap re-draw works;
  - metals survive raids, arrests and lost fights;
  - net worth includes metals.
- **Sim:** a new `market` style buys metal when the price is under 85% of fair value and sells above 110%. No style may be more than 15% faster than balanced, and the balanced bot stays at 8–12 h with gaps of 20 min or less.

## 7. Saves
New fields (`market`, `metals`, `metalCost`) get defaults through `migrate()`. A missing `market` is initialised at fair prices. `SAVE_VERSION` stays 2.
