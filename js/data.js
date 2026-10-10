// All content and tuning numbers for Kingpin. No logic lives here.

export const SAVE_VERSION = 1;
export const NERVE_MAX_BASE = 100;
export const NERVE_REGEN_MS = 6000;
export const HEAT_DECAY_MS = 10000;
export const OFFLINE_CAP_MS = 2 * 60 * 60 * 1000;

// Ranks are reached by Respect. Rank i unlocks mission tier i + 1.
// Godfather is not in this list: it is granted by the win condition.
export const RANKS = [
  { name: 'Street Rat', respect: 0 },
  { name: 'Thief', respect: 60 },
  { name: 'Hustler', respect: 400 },
  { name: 'Enforcer', respect: 2000 },
  { name: 'Boss', respect: 9000 },
  { name: 'Kingpin', respect: 35000 },
];

// type: stealth | muscle | brains. cash is [min, max].
export const MISSIONS = [
  { id: 'pickpocket', name: 'Pickpocket a tourist', tier: 1, type: 'stealth', nerve: 3, baseChance: 0.85, cash: [8, 20], respect: 1, sp: 1, heat: 2 },
  { id: 'snatch', name: 'Snatch a purse and run', tier: 1, type: 'muscle', nerve: 4, baseChance: 0.75, cash: [15, 35], respect: 2, sp: 1, heat: 3 },
  { id: 'bike', name: 'Steal a bike', tier: 1, type: 'brains', nerve: 5, baseChance: 0.70, cash: [25, 55], respect: 2, sp: 1, heat: 3 },

  { id: 'car_breakin', name: 'Break into a parked car', tier: 2, type: 'stealth', nerve: 6, baseChance: 0.75, cash: [90, 200], respect: 5, sp: 2, heat: 4 },
  { id: 'mugging', name: 'Mug a businessman', tier: 2, type: 'muscle', nerve: 7, baseChance: 0.68, cash: [120, 260], respect: 7, sp: 2, heat: 5 },
  { id: 'burglary', name: 'Burglarize a house', tier: 2, type: 'brains', nerve: 8, baseChance: 0.62, cash: [160, 340], respect: 8, sp: 2, heat: 6 },

  { id: 'steal_car', name: 'Steal a sports car', tier: 3, type: 'stealth', nerve: 10, baseChance: 0.65, cash: [900, 1800], respect: 22, sp: 3, heat: 6 },
  { id: 'corner_store', name: 'Rob a corner store', tier: 3, type: 'muscle', nerve: 11, baseChance: 0.60, cash: [1100, 2200], respect: 28, sp: 3, heat: 8 },
  { id: 'racket', name: 'Run a protection racket', tier: 3, type: 'brains', nerve: 12, baseChance: 0.55, cash: [1300, 2600], respect: 30, sp: 3, heat: 7 },

  { id: 'jewelry', name: 'Jewelry store heist', tier: 4, type: 'stealth', nerve: 14, baseChance: 0.55, cash: [7000, 14000], respect: 90, sp: 5, heat: 9 },
  { id: 'hijack', name: 'Hijack a cargo truck', tier: 4, type: 'muscle', nerve: 15, baseChance: 0.50, cash: [8500, 16000], respect: 110, sp: 5, heat: 11 },
  { id: 'extortion', name: 'Extort a city councillor', tier: 4, type: 'brains', nerve: 16, baseChance: 0.45, cash: [10000, 19000], respect: 120, sp: 5, heat: 10 },

  { id: 'casino_vault', name: 'Crack the casino vault', tier: 5, type: 'stealth', nerve: 18, baseChance: 0.45, cash: [55000, 105000], respect: 380, sp: 8, heat: 12 },
  { id: 'bank', name: 'Rob the central bank', tier: 5, type: 'muscle', nerve: 20, baseChance: 0.40, cash: [65000, 125000], respect: 450, sp: 8, heat: 15 },
  { id: 'arms_deal', name: 'Broker an arms deal', tier: 5, type: 'brains', nerve: 22, baseChance: 0.35, cash: [80000, 150000], respect: 500, sp: 8, heat: 13 },

  { id: 'reserve', name: 'Federal reserve heist', tier: 6, type: 'stealth', nerve: 24, baseChance: 0.35, cash: [400000, 750000], respect: 1500, sp: 12, heat: 15 },
  { id: 'turf', name: 'Take over rival turf', tier: 6, type: 'muscle', nerve: 26, baseChance: 0.30, cash: [450000, 850000], respect: 1800, sp: 12, heat: 18 },
  { id: 'mayor', name: 'Bribe the mayor', tier: 6, type: 'brains', nerve: 28, baseChance: 0.25, cash: [550000, 1000000], respect: 2000, sp: 12, heat: 16 },
];

// Police
export const HEAT_MAX = 100;
export const HEAT_CHANCE_PENALTY = 0.003;   // success chance lost per heat point
export const HEAT_ARREST_BONUS = 0.004;     // arrest chance gained per heat point
export const ARREST_BASE = [0.15, 0.19, 0.23, 0.27, 0.31, 0.35]; // by mission tier
export const JAIL_MS_PER_TIER = 20_000;
export const SEIZE_FRACTION = 0.25;          // share of cash on hand taken on arrest
export const BAIL_MIN = 100;
export const BAIL_NET_WORTH_FRACTION = 0.1;
export const BRIBE_PER_HEAT = [4, 25, 150, 900, 5000, 25000]; // by rank

// Skill tree: 3 branches × 5 nodes, bought in order with SP.
// Effect keys: stealthChance, muscleChance, brainsChance (added to success chance),
// heatReduction, payoutBonus, incomeBonus, bailDiscount (fractions),
// nerveMax, power, defense (flat).
export const SKILL_COSTS = [5, 15, 40, 100, 250];
const node = (branch, idx, name, desc, effects) =>
  ({ id: `${branch}${idx}`, branch, idx, name, desc, cost: SKILL_COSTS[idx - 1], effects });
export const SKILLS = [
  node('stealth', 1, 'Light Fingers', '+4% stealth jobs, −8% heat gained', { stealthChance: 0.04, heatReduction: 0.08 }),
  node('stealth', 2, 'Shadow Walker', '+4% stealth jobs, −8% heat gained', { stealthChance: 0.04, heatReduction: 0.08 }),
  node('stealth', 3, 'Lockpicker', '+4% stealth jobs, −8% heat gained', { stealthChance: 0.04, heatReduction: 0.08 }),
  node('stealth', 4, 'Ghost', '+4% stealth jobs, −8% heat gained', { stealthChance: 0.04, heatReduction: 0.08 }),
  node('stealth', 5, 'Phantom', '+4% stealth jobs, −8% heat gained', { stealthChance: 0.04, heatReduction: 0.08 }),

  node('muscle', 1, 'Street Brawler', '+4% muscle jobs, +5 power & defense', { muscleChance: 0.04, power: 5, defense: 5 }),
  node('muscle', 2, 'Tough Skin', '+4% muscle jobs, +15 power & defense', { muscleChance: 0.04, power: 15, defense: 15 }),
  node('muscle', 3, 'Intimidator', '+4% muscle jobs, +40 power & defense', { muscleChance: 0.04, power: 40, defense: 40 }),
  node('muscle', 4, 'Iron Fist', '+4% muscle jobs, +100 power & defense', { muscleChance: 0.04, power: 100, defense: 100 }),
  node('muscle', 5, 'Untouchable', '+4% muscle jobs, +250 power & defense', { muscleChance: 0.04, power: 250, defense: 250 }),

  node('brains', 1, 'Street Smarts', '+4% brains jobs, +5% payouts, +10% business income, −10% bail', { brainsChance: 0.04, payoutBonus: 0.05, incomeBonus: 0.1, bailDiscount: 0.1 }),
  node('brains', 2, 'Planner', '+4% brains jobs, +5% payouts, +10% income, −10% bail, +10 max nerve', { brainsChance: 0.04, payoutBonus: 0.05, incomeBonus: 0.1, bailDiscount: 0.1, nerveMax: 10 }),
  node('brains', 3, 'Fixer', '+4% brains jobs, +5% payouts, +10% business income, −10% bail', { brainsChance: 0.04, payoutBonus: 0.05, incomeBonus: 0.1, bailDiscount: 0.1 }),
  node('brains', 4, 'Mastermind', '+4% brains jobs, +5% payouts, +10% income, −10% bail, +10 max nerve', { brainsChance: 0.04, payoutBonus: 0.05, incomeBonus: 0.1, bailDiscount: 0.1, nerveMax: 10 }),
  node('brains', 5, 'Consigliere', '+4% brains jobs, +5% payouts, +10% business income, −10% bail', { brainsChance: 0.04, payoutBonus: 0.05, incomeBonus: 0.1, bailDiscount: 0.1 }),
];

// Weapons: only the best owned weapon counts. `bonus` is added to the success
// chance of muscle jobs; `power` feeds rival fights and raid defense.
export const BASE_POWER = 10;
export const WEAPON_BONUS_CAP = 0.2;
export const WEAPONS = [
  { id: 'knuckles', name: 'Brass knuckles', price: 150, power: 5, bonus: 0.03, rank: 0 },
  { id: 'knife', name: 'Switchblade', price: 1_200, power: 12, bonus: 0.06, rank: 1 },
  { id: 'pistol', name: 'Pistol', price: 9_000, power: 30, bonus: 0.09, rank: 2 },
  { id: 'shotgun', name: 'Sawed-off shotgun', price: 60_000, power: 70, bonus: 0.12, rank: 3 },
  { id: 'smg', name: 'Tommy gun', price: 400_000, power: 160, bonus: 0.15, rank: 4 },
  { id: 'rifle', name: 'Assault rifle', price: 2_500_000, power: 380, bonus: 0.18, rank: 4 },
  { id: 'rpg', name: 'Rocket launcher', price: 15_000_000, power: 900, bonus: 0.2, rank: 5 },
];

// Vault tiers. Index 0 means no vault. Money in the vault is safe from raids
// and police seizure. fee is taken from each deposit; interest is per hour.
export const VAULTS = [
  { name: 'No vault', price: 0, capacity: 0, fee: 0, interestPerHour: 0 },
  { name: 'Shoebox', price: 50, capacity: 1_000, fee: 0, interestPerHour: 0 },
  { name: 'Safehouse', price: 2_500, capacity: 30_000, fee: 0, interestPerHour: 0 },
  { name: 'Bank account', price: 25_000, capacity: 600_000, fee: 0.02, interestPerHour: 0.005 },
  { name: 'Offshore account', price: 300_000, capacity: 12_000_000, fee: 0.03, interestPerHour: 0.01 },
  { name: 'Swiss vault', price: 4_000_000, capacity: 600_000_000, fee: 0.05, interestPerHour: 0.015 },
];

// Investments earn cash per minute. The n-th copy costs basePrice × 1.15^n.
// heatDecay: each copy speeds up heat decay by this fraction (laundering).
export const INVESTMENT_GROWTH = 1.15;
export const HEAT_DECAY_BONUS_CAP = 2;   // decay at most 3× the normal speed
export const INVESTMENTS = [
  { id: 'hustle', name: 'Corner hustle', basePrice: 300, incomePerMin: 5, rank: 0, heatDecay: 0 },
  { id: 'laundromat', name: 'Laundromat', basePrice: 5_000, incomePerMin: 60, rank: 1, heatDecay: 0.05 },
  { id: 'bar', name: 'Dive bar', basePrice: 40_000, incomePerMin: 400, rank: 2, heatDecay: 0 },
  { id: 'nightclub', name: 'Nightclub', basePrice: 300_000, incomePerMin: 2_500, rank: 3, heatDecay: 0 },
  { id: 'casino', name: 'Casino', basePrice: 2_500_000, incomePerMin: 18_000, rank: 4, heatDecay: 0.15 },
  { id: 'shipping', name: 'Shipping company', basePrice: 20_000_000, incomePerMin: 120_000, rank: 5, heatDecay: 0 },
];

// Rival gangs. Attack them to wear down their hp; the strongest undefeated
// rival you have unlocked raids your cash on hand every 10-20 minutes of play.
export const ATTACK_NERVE = 20;
export const FIGHT_LOSS_HEAT = 10;
export const FIGHT_LOSS_CASH = 0.1;
export const RAID_MIN_MS = 10 * 60_000;
export const RAID_MAX_MS = 20 * 60_000;
export const RAID_STEAL = [0.1, 0.3];
export const OFFLINE_RAID_AFTER_MS = 5 * 60_000;
export const RIVALS = [
  { id: 'rats', name: 'The Dock Rats', boss: 'Fat Tony', rank: 2, power: 60, hp: 3,
    loot: [3_000, 8_000], respect: 60, defeatRespect: 800, raidRespect: 20 },
  { id: 'cuervos', name: 'Los Cuervos', boss: 'El Cuervo', rank: 3, power: 350, hp: 5,
    loot: [60_000, 150_000], respect: 400, defeatRespect: 6_000, raidRespect: 120 },
  { id: 'volkov', name: 'Volkov Bratva', boss: 'Dmitri Volkov', rank: 5, power: 1_200, hp: 8,
    loot: [2_000_000, 5_000_000], respect: 3_000, defeatRespect: 40_000, raidRespect: 800 },
];

// Win condition: all rivals defeated plus these thresholds.
export const GODFATHER = { respect: 150_000, netWorth: 500_000_000 };
