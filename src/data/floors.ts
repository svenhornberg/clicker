// floors.ts — floor and room definitions
import type { Floor, Room, Department, Monster } from '../core/types';
import { allMonsters } from './monsters';
import { randomInt, randomElement, shuffle, chance } from '../utils/random';

function getMonstersByDept(dept: Department, bosses = false): Monster[] {
  return allMonsters.filter(
    (m) => m.department === dept && m.isBoss === bosses
  );
}

function getBoss(dept: Department): Monster {
  const bosses = getMonstersByDept(dept, true);
  if (bosses.length === 0) throw new Error(`No boss for department: ${dept}`);
  return { ...bosses[0] };
}

function makeRoom(
  id: string,
  type: Room['type'],
  dept: Department,
  monster?: Monster
): Room {
  return {
    id,
    type,
    department: dept,
    cleared: false,
    monster: monster ? { ...monster } : undefined,
    available: false,
  };
}

function buildFloor(
  floorNumber: number,
  dept: Department,
  extraRoomTypes: Array<'rest' | 'shop' | 'printer' | 'elite'>
): Floor {
  const normals = shuffle(getMonstersByDept(dept, false));
  const boss = getBoss(dept);

  const rooms: Room[] = [];
  let monsterIdx = 0;

  // 2–3 combat rooms
  const combatCount = randomInt(2, 3);
  for (let i = 0; i < combatCount; i++) {
    const monster = normals[monsterIdx % normals.length];
    monsterIdx++;
    rooms.push(
      makeRoom(`f${floorNumber}_combat${i + 1}`, 'combat', dept, { ...monster })
    );
  }

  // optional special rooms
  for (const rt of extraRoomTypes) {
    if (rt === 'elite') {
      // Elite room uses a regular monster with boosted stats
      const base = normals[monsterIdx % normals.length];
      monsterIdx++;
      const elite: Monster = {
        ...base,
        id: `${base.id}_elite`,
        name: `${base.name} (Senior)`,
        hp: Math.floor(base.hp * 1.5),
        maxHp: Math.floor(base.maxHp * 1.5),
        attackPower: Math.floor(base.attackPower * 1.3),
      };
      rooms.push(makeRoom(`f${floorNumber}_elite`, 'elite', dept, elite));
    } else {
      rooms.push(makeRoom(`f${floorNumber}_${rt}`, rt, dept));
    }
  }

  // Always last: boss room
  rooms.push(makeRoom(`f${floorNumber}_boss`, 'boss', dept, { ...boss }));

  // First room is always available
  if (rooms.length > 0) {
    rooms[0].available = true;
  }

  return {
    id: `floor_${floorNumber}`,
    floorNumber,
    department: dept,
    rooms,
    boss: { ...boss },
  };
}

export function createFloors(): Floor[] {
  return [
    buildFloor(1, 'onboarding', [
      chance(0.5) ? 'rest' : 'printer',
    ]),
    buildFloor(2, 'onboarding', [
      'shop',
      chance(0.4) ? 'printer' : 'rest',
    ]),
    buildFloor(3, 'marketing', [
      chance(0.5) ? 'rest' : 'printer',
    ]),
    buildFloor(4, 'marketing', [
      'shop',
      'elite',
    ]),
    buildFloor(5, 'produkt', [
      'rest',
      chance(0.5) ? 'printer' : 'shop',
    ]),
    buildFloor(6, 'produkt', [
      'shop',
      'elite',
    ]),
    buildFloor(7, 'controlling', [
      chance(0.5) ? 'rest' : 'printer',
    ]),
    buildFloor(8, 'controlling', [
      'shop',
      'elite',
    ]),
    buildFloor(9, 'it', [
      'rest',
      chance(0.5) ? 'printer' : 'shop',
    ]),
    buildFloor(10, 'chefetage', [
      'shop',
      'rest',
    ]),
  ];
}

export { getMonstersByDept };
export type { Floor, Room };

// Static reference (used for display labels etc.)
export const DEPARTMENT_NAMES: Record<Department, string> = {
  onboarding: 'Onboarding',
  marketing: 'Marketing',
  produkt: 'Produkt',
  controlling: 'Controlling',
  it: 'IT',
  chefetage: 'Chefetage',
};

export const ROOM_TYPE_LABELS: Record<Room['type'], string> = {
  combat: 'Büro',
  elite: 'Meetingraum',
  rest: 'Kantine',
  shop: 'Kaffeeküche',
  printer: 'Druckerraum',
  boss: 'Chefbüro',
};

export const randomExtraRooms = (): Array<'rest' | 'shop' | 'printer'> => {
  const pool: Array<'rest' | 'shop' | 'printer'> = ['rest', 'shop', 'printer'];
  const result: Array<'rest' | 'shop' | 'printer'> = [];
  if (chance(0.5)) result.push(randomElement(pool));
  if (chance(0.3)) result.push(randomElement(pool));
  return result;
};
