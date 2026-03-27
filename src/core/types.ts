// types.ts — all interfaces and type definitions
// No logic, no imports from other src folders

export type AttackTag =
  | 'buzzword'
  | 'konkrete-zahl'
  | 'meeting-einladen'
  | 'docu-schreiben'
  | 'eskalieren'
  | 'smalltalk';

export type Department =
  | 'onboarding'
  | 'marketing'
  | 'produkt'
  | 'controlling'
  | 'it'
  | 'chefetage';

export type GemRole = 'active' | 'support' | 'trigger';

export type GemLevel = 1 | 2 | 3;

export interface Gem {
  id: string;
  name: string;
  role: GemRole;
  level: GemLevel;
  description: string;
  tags?: AttackTag[];       // only for active gems
  effectValue: number;
  flavorText: string;
}

export interface SkillSlot {
  active: Gem | null;
  supports: Gem[];          // max 3
  trigger: Gem | null;
}

export type ItemSlot =
  | 'helm'
  | 'weapon'
  | 'offhand'
  | 'armor'
  | 'gloves'
  | 'shoes'
  | 'amulet'
  | 'ring1'
  | 'ring2';

export interface ItemStats {
  armor?: number;
  attackSpeed?: number;
  critChance?: number;
  escapeChance?: number;
  gold?: number;
  concentration?: number;
  damage?: number;
  hpRegen?: number;
}

export interface Item {
  id: string;
  name: string;
  slot: ItemSlot;
  description: string;
  stats: ItemStats;
  flavorText: string;
}

export interface Monster {
  id: string;
  name: string;
  department: Department;
  hp: number;
  maxHp: number;
  armor: number;
  attackPower: number;
  weaknesses: AttackTag[];
  resistances: AttackTag[];
  immunities: AttackTag[];
  flavorText: string;
  isBoss: boolean;
  specialAbilityName?: string;
  specialAbilityDescription?: string;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  armor: number;
  attackSpeed: number;
  critChance: number;
  escapeChance: number;
  gold: number;
  concentration: number;
}

export type EquipmentSlots = Record<ItemSlot, Item | null>;

export interface GameState {
  player: PlayerStats;
  equipment: EquipmentSlots;
  skillSlots: SkillSlot[];
  inventory: Item[];
  gemInventory: Gem[];
  currentFloor: number;
  currentRoom: number;
  defeatedMonsters: string[];
  visitedRooms: string[];
  phase: 'map' | 'combat' | 'loot' | 'shop' | 'rest' | 'printer' | 'gameover' | 'victory';
  pendingLoot?: LootResult;
  pendingMonster?: Monster;
  shopItems?: Item[];
  shopGems?: Gem[];
  shopPurchased?: string[];
  printerResult?: 'loot' | 'damage' | null;
}

export interface CombatState {
  enemy: Monster;
  playerHp: number;
  enemyHp: number;
  round: number;
  log: string[];
  isPlayerTurn: boolean;
  isOver: boolean;
  playerWon: boolean;
  roundsWithoutPlayerAttack: number;
  postMeetingBurst: boolean;
  ueberstundenTriggered: boolean;
  koffeinActive: boolean;
  dringlichPenalty: boolean;
  enemySpecialUsed: boolean;
  influencerHealActive: boolean;
}

export interface ResistanceModifier {
  department: Department;
  tag: AttackTag;
  modifier: number | 'immune';
}

export type RoomType = 'combat' | 'elite' | 'rest' | 'shop' | 'printer' | 'boss';

export interface Room {
  id: string;
  type: RoomType;
  department: Department;
  cleared: boolean;
  monster?: Monster;
  available: boolean;
}

export interface Floor {
  id: string;
  floorNumber: number;
  department: Department;
  rooms: Room[];
  boss: Monster;
}

export interface LootResult {
  gems: Gem[];
  items: Item[];
  gold: number;
  isDamageEvent?: boolean;
  damageAmount?: number;
  message?: string;
}
