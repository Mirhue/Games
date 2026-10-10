// All content and tuning numbers for Kingpin. No logic lives here.

export const SAVE_VERSION = 2;
export const NERVE_MAX_BASE = 100;
export const NERVE_REGEN_MS = 6000;
export const HEAT_DECAY_MS = 10000;
export const OFFLINE_CAP_MS = 2 * 60 * 60 * 1000;

// Perks from skills, weapons and businesses add up; these caps apply to the
// total from all sources together so no combination becomes free.
export const PERK_CAPS = {
  nerveRegen: 1,       // nerve regenerates at most 2× as fast
  heatDecay: 2,        // heat decays at most 3× as fast
  heatReduction: 0.75, // jobs give at least 25% of their heat
  nerveMax: 150,       // at most +150 max nerve
  bailDiscount: 0.9,
};

// Ranks are reached by Respect. Rank i unlocks mission tier i + 1.
// Godfather is not in this list: it is granted by the win condition.
export const RANKS = [
  { name: 'Street Rat', respect: 0 },
  { name: 'Thief', respect: 60 },
  { name: 'Hustler', respect: 200 },
  { name: 'Enforcer', respect: 1000 },
  { name: 'Boss', respect: 4500 },
  { name: 'Kingpin', respect: 18000 },
];

// type: stealth | muscle | brains. cash is [min, max].
export const MISSIONS = [
  { id: 'pickpocket', icon: 'wallet', name: 'Pickpocket a tourist', tier: 1, type: 'stealth', nerve: 3, baseChance: 0.85, cash: [8, 20], respect: 1, sp: 1, heat: 2 },
  { id: 'snatch', icon: 'shiny-purse', name: 'Snatch a purse and run', tier: 1, type: 'muscle', nerve: 4, baseChance: 0.75, cash: [15, 35], respect: 2, sp: 1, heat: 3 },
  { id: 'bike', icon: 'dutch-bike', name: 'Steal a bike', tier: 1, type: 'brains', nerve: 5, baseChance: 0.70, cash: [25, 55], respect: 2, sp: 1, heat: 3 },

  { id: 'car_breakin', icon: 'car-key', name: 'Break into a parked car', tier: 2, type: 'stealth', nerve: 6, baseChance: 0.75, cash: [90, 200], respect: 5, sp: 2, heat: 4 },
  { id: 'mugging', icon: 'robber', name: 'Mug a businessman', tier: 2, type: 'muscle', nerve: 7, baseChance: 0.68, cash: [120, 260], respect: 7, sp: 2, heat: 5 },
  { id: 'burglary', icon: 'house-keys', name: 'Burglarize a house', tier: 2, type: 'brains', nerve: 8, baseChance: 0.62, cash: [160, 340], respect: 8, sp: 2, heat: 6 },

  { id: 'steal_car', icon: 'race-car', name: 'Steal a sports car', tier: 3, type: 'stealth', nerve: 10, baseChance: 0.65, cash: [900, 1800], respect: 22, sp: 3, heat: 6 },
  { id: 'corner_store', icon: 'shop', name: 'Rob a corner store', tier: 3, type: 'muscle', nerve: 11, baseChance: 0.60, cash: [1100, 2200], respect: 28, sp: 3, heat: 8 },
  { id: 'racket', icon: 'pay-money', name: 'Run a protection racket', tier: 3, type: 'brains', nerve: 12, baseChance: 0.55, cash: [1300, 2600], respect: 30, sp: 3, heat: 7 },

  { id: 'jewelry', icon: 'diamond-ring', name: 'Jewelry store heist', tier: 4, type: 'stealth', nerve: 14, baseChance: 0.55, cash: [7000, 14000], respect: 90, sp: 5, heat: 9 },
  { id: 'hijack', icon: 'truck', name: 'Hijack a cargo truck', tier: 4, type: 'muscle', nerve: 15, baseChance: 0.50, cash: [8500, 16000], respect: 110, sp: 5, heat: 11 },
  { id: 'extortion', icon: 'briefcase', name: 'Extort a city councillor', tier: 4, type: 'brains', nerve: 16, baseChance: 0.45, cash: [10000, 19000], respect: 120, sp: 5, heat: 10 },

  { id: 'casino_vault', icon: 'open-treasure-chest', name: 'Crack the casino vault', tier: 5, type: 'stealth', nerve: 18, baseChance: 0.45, cash: [55000, 105000], respect: 380, sp: 8, heat: 12 },
  { id: 'bank', icon: 'bank', name: 'Rob the central bank', tier: 5, type: 'muscle', nerve: 20, baseChance: 0.40, cash: [65000, 125000], respect: 450, sp: 8, heat: 15 },
  { id: 'arms_deal', icon: 'cargo-crate', name: 'Broker an arms deal', tier: 5, type: 'brains', nerve: 22, baseChance: 0.35, cash: [80000, 150000], respect: 500, sp: 8, heat: 13 },

  { id: 'reserve', icon: 'money-stack', name: 'Federal reserve heist', tier: 6, type: 'stealth', nerve: 24, baseChance: 0.35, cash: [400000, 750000], respect: 1500, sp: 12, heat: 15 },
  { id: 'turf', icon: 'flag-objective', name: 'Take over rival turf', tier: 6, type: 'muscle', nerve: 26, baseChance: 0.30, cash: [450000, 850000], respect: 1800, sp: 12, heat: 18 },
  { id: 'mayor', icon: 'capitol', name: 'Bribe the mayor', tier: 6, type: 'brains', nerve: 28, baseChance: 0.25, cash: [550000, 1000000], respect: 2000, sp: 12, heat: 16 },
];

// Job mastery: every successful run of a job counts toward its mastery.
// Each level cuts the job's nerve cost and raises its success chance; a
// Master job sometimes gives its nerve back on success.
export const MASTERY = {
  levels: [
    { name: 'Novice', at: 0 },
    { name: 'Skilled', at: 10 },
    { name: 'Expert', at: 40 },
    { name: 'Master', at: 120 },
  ],
  nerveCut: 0.1,       // per level
  chance: 0.03,        // per level
  refundChance: 0.2,   // Master only
};

// Outgrown jobs: a job 2+ tiers below your top tier gets easier per tier.
export const OUTGROWN = {
  max: 3,
  nerveCut: 0.2,       // per level
  chance: 0.05,        // per level
  heatFactor: 0.5,     // heat multiplier per level
};

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

// Skill tree: 4 branches. Level 1 of a node unlocks the next node in its
// branch; every node can keep leveling up to maxLevel. Level L costs
// baseCost × SKILL_GROWTH^(L−1). effects are per level (see PERK_CAPS).
export const SKILL_GROWTH = 1.6;
const MAX_LEVELS = [5, 5, 5, 3, 1];
const BASE_COSTS = [3, 10, 30, 100, 350];
const SKILL_ICONS = {
  stealth1: 'robber-hand',
  stealth2: 'hooded-figure',
  stealth3: 'lockpicks',
  stealth4: 'hooded-assassin',
  stealth5: 'robber-mask',
  muscle1: 'fist',
  muscle2: 'muscle-up',
  muscle3: 'jason-mask',
  muscle4: 'mailed-fist',
  muscle5: 'thor-fist',
  brains1: 'brain',
  brains2: 'stopwatch',
  brains3: 'poker-hand',
  brains4: 'hive-mind',
  brains5: 'scales',
  street1: 'sprint',
  street2: 'snowflake-1',
  street3: 'lungs',
};
const node = (branch, idx, name, effects, { maxLevel = MAX_LEVELS[idx - 1], baseCost = BASE_COSTS[idx - 1] } = {}) =>
  ({ id: `${branch}${idx}`, icon: SKILL_ICONS[`${branch}${idx}`], branch, idx, name, maxLevel, baseCost, effects });
export const SKILL_BRANCHES = [
  { id: 'stealth', name: 'Stealth' },
  { id: 'muscle', name: 'Muscle' },
  { id: 'brains', name: 'Brains' },
  { id: 'street', name: 'Street Life' },
];
const brains = { brainsChance: 0.01, payoutBonus: 0.01, incomeBonus: 0.02, bailDiscount: 0.02 };
export const SKILLS = [
  node('stealth', 1, 'Light Fingers', { stealthChance: 0.01, heatReduction: 0.02 }),
  node('stealth', 2, 'Shadow Walker', { stealthChance: 0.01, heatReduction: 0.02 }),
  node('stealth', 3, 'Lockpicker', { stealthChance: 0.01, heatReduction: 0.02 }),
  node('stealth', 4, 'Ghost', { stealthChance: 0.015, heatReduction: 0.03 }),
  node('stealth', 5, 'Phantom', { stealthChance: 0.04, heatReduction: 0.06 }),

  node('muscle', 1, 'Street Brawler', { muscleChance: 0.01, power: 2, defense: 2 }),
  node('muscle', 2, 'Tough Skin', { muscleChance: 0.01, power: 6, defense: 6 }),
  node('muscle', 3, 'Intimidator', { muscleChance: 0.01, power: 15, defense: 15 }),
  node('muscle', 4, 'Iron Fist', { muscleChance: 0.015, power: 40, defense: 40 }),
  node('muscle', 5, 'Untouchable', { muscleChance: 0.04, power: 150, defense: 150 }),

  node('brains', 1, 'Street Smarts', brains),
  node('brains', 2, 'Planner', { ...brains, nerveMax: 3 }),
  node('brains', 3, 'Fixer', brains),
  node('brains', 4, 'Mastermind', { brainsChance: 0.015, payoutBonus: 0.02, incomeBonus: 0.03, bailDiscount: 0.03, nerveMax: 3 }),
  node('brains', 5, 'Consigliere', { brainsChance: 0.04, payoutBonus: 0.05, incomeBonus: 0.1, bailDiscount: 0.06 }),

  node('street', 1, 'Stamina', { nerveRegen: 0.06 }, { maxLevel: 5, baseCost: 8 }),
  node('street', 2, 'Cool Head', { heatDecay: 0.1 }, { maxLevel: 5, baseCost: 25 }),
  node('street', 3, 'Second Wind', { nerveMax: 10 }, { maxLevel: 3, baseCost: 80 }),
];

// Weapons arm your crew: every copy adds its power to power and defense,
// and the n-th copy costs price × WEAPON_GROWTH^n. The muscle-job `bonus`
// comes from your best weapon type only. perks are per copy (see PERK_CAPS).
export const BASE_POWER = 10;
export const WEAPON_BONUS_CAP = 0.2;
export const WEAPON_GROWTH = 1.25;
export const WEAPONS = [
  { id: 'knuckles', icon: 'brass-knuckles', name: 'Brass knuckles', price: 150, power: 5, bonus: 0.03, rank: 0 },
  { id: 'knife', icon: 'switchblade', name: 'Switchblade', price: 1_200, power: 12, bonus: 0.06, rank: 1, perks: { heatReduction: 0.02 } },
  { id: 'pistol', icon: 'pistol-gun', name: 'Silenced pistol', price: 9_000, power: 30, bonus: 0.09, rank: 2, perks: { heatReduction: 0.03 } },
  { id: 'shotgun', icon: 'sawed-off-shotgun', name: 'Sawed-off shotgun', price: 60_000, power: 70, bonus: 0.12, rank: 3, perks: { nerveMax: 3 } },
  { id: 'smg', icon: 'machine-gun', name: 'Tommy gun', price: 400_000, power: 160, bonus: 0.15, rank: 4, perks: { nerveRegen: 0.04 } },
  { id: 'rifle', icon: 'ak47', name: 'Assault rifle', price: 2_500_000, power: 380, bonus: 0.18, rank: 4, perks: { nerveMax: 5 } },
  { id: 'rpg', icon: 'missile-launcher', name: 'Rocket launcher', price: 15_000_000, power: 900, bonus: 0.2, rank: 5 },
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
// perks are per copy (see PERK_CAPS), e.g. heatDecay: laundering money.
export const INVESTMENT_GROWTH = 1.15;
export const INVESTMENTS = [
  { id: 'hustle', icon: 'hoodie', name: 'Corner hustle', basePrice: 200, incomePerMin: 5, rank: 0 },
  { id: 'laundromat', icon: 'washing-machine', name: 'Laundromat', basePrice: 3_000, incomePerMin: 40, rank: 1, perks: { heatDecay: 0.05 } },
  { id: 'gym', icon: 'punching-bag', name: 'Boxing gym', basePrice: 4_000, incomePerMin: 45, rank: 1, perks: { nerveMax: 2 } },
  { id: 'bar', icon: 'beer-bottle', name: 'Dive bar', basePrice: 25_000, incomePerMin: 550, rank: 2 },
  { id: 'pharmacy', icon: 'medicine-pills', name: 'Pharmacy', basePrice: 30_000, incomePerMin: 330, rank: 2, perks: { nerveRegen: 0.03 } },
  { id: 'nightclub', icon: 'martini', name: 'Nightclub', basePrice: 200_000, incomePerMin: 4_200, rank: 3 },
  { id: 'casino', icon: 'slot-machine', name: 'Casino', basePrice: 1_600_000, incomePerMin: 18_000, rank: 4, perks: { heatDecay: 0.15 } },
  { id: 'lawfirm', icon: 'gavel', name: 'Law firm', basePrice: 2_500_000, incomePerMin: 26_000, rank: 4, perks: { heatDecay: 0.25, bailDiscount: 0.05 } },
  { id: 'shipping', icon: 'cargo-ship', name: 'Shipping company', basePrice: 12_000_000, incomePerMin: 260_000, rank: 5 },
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
  { id: 'rats', icon: 'rat', name: 'The Dock Rats', boss: 'Fat Tony', rank: 2, power: 60, hp: 3,
    loot: [3_000, 8_000], respect: 60, defeatRespect: 800, defeatSp: 100, raidRespect: 20 },
  { id: 'cuervos', icon: 'raven', name: 'Los Cuervos', boss: 'El Cuervo', rank: 3, power: 350, hp: 5,
    loot: [60_000, 150_000], respect: 400, defeatRespect: 6_000, defeatSp: 200, raidRespect: 120 },
  { id: 'volkov', icon: 'bear-head', name: 'Volkov Bratva', boss: 'Dmitri Volkov', rank: 5, power: 700, hp: 6,
    loot: [2_000_000, 5_000_000], respect: 3_000, defeatRespect: 40_000, defeatSp: 300, raidRespect: 800 },
];

// Win condition: all rivals defeated plus these thresholds.
export const GODFATHER = { respect: 150_000, netWorth: 500_000_000 };
