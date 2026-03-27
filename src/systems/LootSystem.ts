// LootSystem.ts — loot generation and shop
import type { Monster, LootResult, Item, Gem } from '../core/types';
import { allItems } from '../data/items';
import { activeGems, supportGems, triggerGems, allGems } from '../data/gems';
import { randomInt, randomElement, randomElements, chance } from '../utils/random';

function pickGem(ownedGemIds: string[]): Gem {
  // Prefer gems the player doesn't already own; fall back to full pool if all owned
  const unownedPool = allGems.filter((g) => !ownedGemIds.includes(g.id));
  const pool = unownedPool.length > 0 ? unownedPool : allGems;
  return { ...randomElement(pool) };
}

export function generateLoot(monster: Monster, floor: number, ownedGemIds: string[] = []): LootResult {
  const gold = randomInt(
    5 + floor * 2,
    15 + floor * 5
  );

  if (monster.isBoss) {
    // Bosses always drop 2 gems + 1 item
    const gems = [pickGem(ownedGemIds), pickGem([...ownedGemIds, pickGem(ownedGemIds).id])];
    const items = randomElements(allItems, 1).map((i) => ({ ...i }));
    return {
      gems,
      items,
      gold: gold * 2,
      message: `${monster.name} besiegt! Exzellente Beute!`,
    };
  }

  const gems: Gem[] = [];
  const items: Item[] = [];

  // 60% chance for 1 gem
  if (chance(0.6)) {
    gems.push(pickGem(ownedGemIds));
  }

  // 30% chance for 1 item
  if (chance(0.3)) {
    items.push({ ...randomElement(allItems) });
  }

  return {
    gems,
    items,
    gold,
  };
}

export function generatePrinterLoot(floor: number): LootResult {
  // 50/50: rare loot or damage event
  if (chance(0.5)) {
    // Good result: rare gems (higher level pool)
    const gem = { ...randomElement(allGems), level: Math.min(3, 2) as 1 | 2 | 3 };
    return {
      gems: [gem],
      items: [],
      gold: randomInt(10, 30),
      isDamageEvent: false,
      message: 'Der Drucker funktioniert! Ein Dokument wartet auf dich.',
    };
  } else {
    // Bad result: damage event
    const dmg = randomInt(10 + floor * 2, 20 + floor * 3);
    return {
      gems: [],
      items: [],
      gold: 0,
      isDamageEvent: true,
      damageAmount: dmg,
      message: `Papierstau! ${dmg} Schaden durch heiße Druckertinte.`,
    };
  }
}

export function getShopItems(floor: number): Item[] {
  // Pick 3 random items, slightly favor higher-stat items on higher floors
  const pool = floor > 5
    ? allItems.filter((i) => Object.values(i.stats).some((v) => v !== undefined && v > 5))
    : allItems;
  return randomElements(pool.length >= 3 ? pool : allItems, 3).map((i) => ({ ...i }));
}

export function getShopGems(floor: number): Gem[] {
  // Pick 3 random gems; on higher floors, include more triggers/supports
  const pool = floor > 5
    ? [...supportGems, ...triggerGems, ...activeGems]
    : [...activeGems, ...supportGems, ...triggerGems];
  return randomElements(pool, 3).map((g) => ({ ...g }));
}

export function getItemShopPrice(item: Item, floor: number): number {
  const basePrice = 30 + floor * 5;
  const statSum = Object.values(item.stats).reduce(
    (acc, v) => acc + (typeof v === 'number' ? v : 0),
    0
  );
  return Math.floor(basePrice + statSum * 2);
}

export function getGemShopPrice(gem: Gem, floor: number): number {
  return Math.floor(20 + floor * 3 + gem.effectValue + gem.level * 15);
}
