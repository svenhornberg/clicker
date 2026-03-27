// GemFusionSystem.ts — gem fusion logic
import type { Gem, GemLevel } from '../core/types';

export function canFuse(gem1: Gem, gem2: Gem): boolean {
  return (
    gem1.id === gem2.id &&
    gem1.level === gem2.level &&
    gem1.level < 3
  );
}

export function fuseGems(gem1: Gem, gem2: Gem): Gem {
  if (!canFuse(gem1, gem2)) {
    throw new Error(`Cannot fuse ${gem1.id} (level ${gem1.level}) with ${gem2.id} (level ${gem2.level})`);
  }

  const newLevel = (gem1.level + 1) as GemLevel;
  const scaleFactor = 1 + newLevel * 0.3;
  const newEffectValue = Math.floor(gem1.effectValue * scaleFactor);

  return {
    ...gem1,
    level: newLevel,
    effectValue: newEffectValue,
    name: `${gem1.name} +${newLevel}`,
    description: `${gem1.description} (Level ${newLevel})`,
  };
}

export function findFusionPairs(gems: Gem[]): Array<[Gem, Gem]> {
  const pairs: Array<[Gem, Gem]> = [];
  const seen = new Set<number>();

  for (let i = 0; i < gems.length; i++) {
    if (seen.has(i)) continue;
    for (let j = i + 1; j < gems.length; j++) {
      if (seen.has(j)) continue;
      if (canFuse(gems[i], gems[j])) {
        pairs.push([gems[i], gems[j]]);
        seen.add(i);
        seen.add(j);
        break;
      }
    }
  }

  return pairs;
}
