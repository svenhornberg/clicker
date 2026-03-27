// MetaSystem.ts — meta progression logic
import type { GameState, MetaState, Item, SkillSlot } from '../core/types';
import { allMetaUpgrades } from '../data/metaUpgrades';
import { supportGems } from '../data/gems';
import { randomInt } from '../utils/random';

export function createDefaultMetaState(): MetaState {
  return {
    betriebsjahre: 0,
    upgrades: {},
    highestFloorReached: 0,
    totalRuns: 0,
    victories: 0,
  };
}

export function calculateBetriebsjahre(
  floorsCleared: number,
  bossesDefeated: number,
  won: boolean,
  finalHpPercent: number
): number {
  let total = 0;
  // Each floor cleared: floor_number × 10 — we treat floorsCleared as the sum
  // Actually we pass total floors cleared count, give 10 per floor
  total += floorsCleared * 10;
  total += bossesDefeated * 50;
  if (won) total += 200;
  if (!won && finalHpPercent > 50) total += 20;
  return total;
}

export function applyMetaUpgrades(baseGameState: GameState, metaState: MetaState): GameState {
  let state = { ...baseGameState };
  let player = { ...state.player };

  // +25 Max-HP per level of Mehr-Leben (meta_kaffee_toleranz)
  const kaffeeLvl = getUpgrade(metaState, 'meta_kaffee_toleranz');
  if (kaffeeLvl > 0) {
    const bonus = kaffeeLvl * 25;
    player.maxHp += bonus;
    player.hp += bonus;
  }

  // +10 Rüstung per level of Dickere-Haut
  const hautLvl = getUpgrade(metaState, 'meta_dickere_haut');
  if (hautLvl > 0) {
    player.armor += hautLvl * 10;
  }

  // Schnelltipper: stored in attackSpeed (used by CombatSystem for cooldown calc)
  // attackSpeed bonus is encoded as the upgrade level — CombatSystem reads getCooldownMultiplier

  // Direkteinstieg: start on floor 3
  if (getUpgrade(metaState, 'meta_fruehstart') >= 1) {
    state = { ...state, currentFloor: 3 };
  }

  // Eigene Ausrüstung: start with Mechanische Tastatur equipped
  if (getUpgrade(metaState, 'meta_startitem_keyboard') >= 1) {
    const keyboard: Item = {
      id: 'item_keyboard_weapon',
      name: 'Mechanische Tastatur',
      slot: 'weapon',
      description: '+15 Einschüchterung durch Geräuschkulisse',
      stats: { damage: 15 },
      flavorText: 'Cherry MX Red. Jeder hört es.',
    };
    const newEquipment = { ...state.equipment, weapon: keyboard };
    state = { ...state, equipment: newEquipment };
  }

  // Weiterbildung: start with a random extra support gem
  const startgemLvl = getUpgrade(metaState, 'meta_startgem');
  if (startgemLvl > 0) {
    const bonusGems = [];
    for (let i = 0; i < startgemLvl; i++) {
      const idx = randomInt(0, supportGems.length - 1);
      bonusGems.push({ ...supportGems[idx] });
    }
    state = { ...state, gemInventory: [...state.gemInventory, ...bonusGems] };
  }

  // Größerer Schreibtisch: extra skill slots
  const extraSlots = getUpgrade(metaState, 'meta_extra_slot');
  if (extraSlots > 0) {
    const added: SkillSlot[] = Array.from({ length: extraSlots }, () => ({
      active: null,
      supports: [],
      trigger: null,
    }));
    state = { ...state, skillSlots: [...state.skillSlots, ...added] };
  }

  state = { ...state, player };
  return state;
}

export function getUpgrade(metaState: MetaState, upgradeId: string): number {
  return metaState.upgrades[upgradeId] ?? 0;
}

export function canAfford(metaState: MetaState, upgradeId: string): boolean {
  const upgrade = allMetaUpgrades.find((u) => u.id === upgradeId);
  if (!upgrade) return false;
  const currentLevel = getUpgrade(metaState, upgradeId);
  if (currentLevel >= upgrade.maxLevel) return false;
  const cost = upgrade.costPerLevel[currentLevel];
  return metaState.betriebsjahre >= cost;
}

export function purchaseUpgrade(metaState: MetaState, upgradeId: string): MetaState {
  const upgrade = allMetaUpgrades.find((u) => u.id === upgradeId);
  if (!upgrade) return metaState;
  const currentLevel = getUpgrade(metaState, upgradeId);
  if (currentLevel >= upgrade.maxLevel) return metaState;
  const cost = upgrade.costPerLevel[currentLevel];
  if (metaState.betriebsjahre < cost) return metaState;

  return {
    ...metaState,
    betriebsjahre: metaState.betriebsjahre - cost,
    upgrades: {
      ...metaState.upgrades,
      [upgradeId]: currentLevel + 1,
    },
  };
}

// Returns cooldown multiplier: 1.0 = base, lower = faster
// 3 levels of schnelltipper: 3 × 0.12 = 0.36 reduction → 0.64
export function getCooldownMultiplier(metaState: MetaState): number {
  const lvl = getUpgrade(metaState, 'meta_schnelltipper');
  return Math.max(0.4, 1 - lvl * 0.12);
}

// Returns buzzword meta bonus as a decimal: 0 to 0.45 (3 × 0.15)
export function getBuzzwordMetaBonus(metaState: MetaState): number {
  const lvl = getUpgrade(metaState, 'meta_buzzword_bibliothek');
  return lvl * 0.15;
}

// Returns shop discount: 0 or 0.15
export function getShopDiscount(metaState: MetaState): number {
  return getUpgrade(metaState, 'meta_shop_rabatt') >= 1 ? 0.15 : 0;
}

// Returns gold bonus per combat from Networking-Profi
export function getNetworkingGoldBonus(metaState: MetaState): number {
  return getUpgrade(metaState, 'meta_networking') * 15;
}

// Returns boss HP multiplier (e.g. 0.9 for 1 level, 0.8 for 2 levels)
export function getBossHpMultiplier(metaState: MetaState): number {
  const lvl = getUpgrade(metaState, 'meta_krisenfest');
  return Math.max(0.5, 1 - lvl * 0.1);
}

// Returns heal fraction after combat victory (0 = no heal, 0.15 per level)
export function getHealAfterCombat(metaState: MetaState): number {
  return getUpgrade(metaState, 'meta_heilung') * 0.15;
}

// Returns true if auto-clicker should start automatically at run start
export function getAutoStartEnabled(metaState: MetaState): boolean {
  return getUpgrade(metaState, 'meta_auto_start') >= 1;
}
