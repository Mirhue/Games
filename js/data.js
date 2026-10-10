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
