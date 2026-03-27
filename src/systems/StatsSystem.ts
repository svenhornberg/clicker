// StatsSystem.ts — calculate effective player stats
import type { GameState, PlayerStats, Item } from '../core/types';

export const BASE_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  armor: 5,
  attackSpeed: 100,
  critChance: 5,
  escapeChance: 10,
  gold: 0,
  concentration: 10,
};

export function applyItemStats(base: PlayerStats, item: Item): PlayerStats {
  const result = { ...base };
  const s = item.stats;

  if (s.armor !== undefined) result.armor += s.armor;
  if (s.attackSpeed !== undefined) result.attackSpeed += s.attackSpeed;
  if (s.critChance !== undefined) result.critChance += s.critChance;
  if (s.escapeChance !== undefined) result.escapeChance += s.escapeChance;
  if (s.gold !== undefined) result.gold += s.gold;
  if (s.concentration !== undefined) result.concentration += s.concentration;
  if (s.damage !== undefined) result.armor += 0; // damage handled in combat
  if (s.hpRegen !== undefined) result.concentration += s.hpRegen; // tracked via concentration proxy

  return result;
}

export function calculateStats(gameState: GameState): PlayerStats {
  let stats: PlayerStats = {
    ...BASE_STATS,
    hp: gameState.player.hp,
    maxHp: gameState.player.maxHp,
    gold: gameState.player.gold,
  };

  for (const item of Object.values(gameState.equipment)) {
    if (item) {
      stats = applyItemStats(stats, item);
    }
  }

  return stats;
}

export function getWeaponDamageBonus(gameState: GameState): number {
  let bonus = 0;
  for (const item of Object.values(gameState.equipment)) {
    if (item?.stats.damage) bonus += item.stats.damage;
  }
  return bonus;
}

export function getHpRegenPerRound(gameState: GameState): number {
  let regen = 0;
  for (const item of Object.values(gameState.equipment)) {
    if (item?.stats.hpRegen) regen += item.stats.hpRegen;
  }
  return regen;
}

export function getBuzzwordBonus(gameState: GameState): number {
  // item_suit_armor gives +10% buzzword effectiveness
  const armor = gameState.equipment['armor'];
  if (armor?.id === 'item_suit_armor') return 10;
  return 0;
}

export function hasSmallTalkImmunity(gameState: GameState): boolean {
  // item_headphones_helm grants immunity to smalltalk interrupt
  const helm = gameState.equipment['helm'];
  return helm?.id === 'item_headphones_helm';
}

export function getGoldBonusPerCombat(gameState: GameState): number {
  const amulet = gameState.equipment['amulet'];
  if (amulet?.id === 'item_creditcard_amulet') return amulet.stats.gold ?? 0;
  return 0;
}
