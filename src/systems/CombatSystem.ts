// CombatSystem.ts — core combat logic
import type {
  Gem,
  Monster,
  PlayerStats,
  GameState,
  CombatState,
  AttackTag,
  Department,
} from '../core/types';
import { randomInt, chance } from '../utils/random';
import {
  getWeaponDamageBonus,
  getBuzzwordBonus,
  getHpRegenPerRound,
} from './StatsSystem';

// ─── Department Resistance Table ─────────────────────────────────────────────
// From CLAUDE.md section 3
// Returns modifier as a multiplier offset: 0.5 means +50%, -0.3 means -30%
// Returns null for 'immune'

type ModTable = Record<AttackTag, Record<Department, number | 'immune'>>;

const RESISTANCE_TABLE: ModTable = {
  'buzzword': {
    onboarding: 0,
    marketing: 0.5,
    produkt: 0,
    controlling: -0.3,
    it: 'immune',
    chefetage: 0.2,
  },
  'konkrete-zahl': {
    onboarding: 0,
    marketing: 0.7,
    produkt: 0.2,
    controlling: 'immune',
    it: 0,
    chefetage: -0.2,
  },
  'meeting-einladen': {
    onboarding: 0,
    marketing: -0.2,
    produkt: 0.4,
    controlling: 0.2,
    it: 0.8,
    chefetage: 0,
  },
  'docu-schreiben': {
    onboarding: 0,
    marketing: 0,
    produkt: 0.3,
    controlling: 0.5,
    it: -0.5,
    chefetage: 0,
  },
  'eskalieren': {
    onboarding: 0,
    marketing: 0.3,
    produkt: 0.5,
    controlling: 0.6,
    it: 0,
    chefetage: 'immune',
  },
  'smalltalk': {
    onboarding: 0,
    marketing: -0.3,
    produkt: 0,
    controlling: 0.4,
    it: 0.6,
    chefetage: -0.4,
  },
};

export function getDepartmentModifier(
  tags: AttackTag[],
  department: Department
): number | 'immune' {
  let totalMod = 0;
  for (const tag of tags) {
    const mod = RESISTANCE_TABLE[tag][department];
    if (mod === 'immune') return 'immune';
    totalMod += mod;
  }
  return totalMod;
}

export function calculateDamage(
  gem: Gem,
  supports: Gem[],
  department: Department,
  playerStats: PlayerStats,
  gameState: GameState
): number {
  if (!gem.tags || gem.tags.length === 0) return gem.effectValue;

  let baseDamage = gem.effectValue;

  // Weapon damage bonus
  baseDamage += getWeaponDamageBonus(gameState);

  // Buzzword suit bonus
  const buzzwordBonus = getBuzzwordBonus(gameState);
  if (buzzwordBonus > 0 && gem.tags.includes('buzzword')) {
    baseDamage = Math.floor(baseDamage * (1 + buzzwordBonus / 100));
  }

  // Support gem modifiers
  let supportMultiplier = 1;
  let hasDringlichPenaltyApplied = false;

  for (const support of supports) {
    switch (support.id) {
      case 'gem_anglizismus_support':
        // +40% if active gem has buzzword tag
        if (gem.tags.includes('buzzword')) {
          supportMultiplier += (support.effectValue / 100) * support.level;
        }
        break;
      case 'gem_dringlich_support':
        // +25% but dringlich penalty applies next round (tracked in combatState)
        supportMultiplier += (support.effectValue / 100) * support.level;
        hasDringlichPenaltyApplied = true;
        break;
      case 'gem_bulletpoint_support':
        // -20% resistance (handled below as extra modifier on base)
        supportMultiplier += (support.effectValue / 100) * 0.5 * support.level;
        break;
      case 'gem_overtime_support':
        supportMultiplier += (support.effectValue / 100) * support.level;
        break;
      case 'gem_powerpoint_support':
        supportMultiplier += (support.effectValue / 100) * support.level;
        break;
    }
  }

  void hasDringlichPenaltyApplied; // used externally via combat state

  baseDamage = Math.floor(baseDamage * supportMultiplier);

  // Department modifier
  const deptMod = getDepartmentModifier(gem.tags, department);
  if (deptMod === 'immune') return 0;

  baseDamage = Math.floor(baseDamage * (1 + deptMod));

  // Crit check
  if (chance(playerStats.critChance / 100)) {
    baseDamage = Math.floor(baseDamage * 1.5);
  }

  // Scale with gem level
  const levelScale = 1 + (gem.level - 1) * 0.3;
  baseDamage = Math.floor(baseDamage * levelScale);

  return Math.max(1, baseDamage);
}

export function enemyAttack(monster: Monster, playerArmor: number): number {
  const raw = monster.attackPower + randomInt(-3, 3);
  const reduced = Math.max(1, raw - Math.floor(playerArmor / 5));
  return reduced;
}

export function initCombat(monster: Monster, playerStats: PlayerStats): CombatState {
  return {
    enemy: { ...monster, hp: monster.maxHp },
    playerHp: playerStats.hp,
    enemyHp: monster.maxHp,
    round: 1,
    log: [`Kampf beginnt gegen ${monster.name}!`],
    isPlayerTurn: true,
    isOver: false,
    playerWon: false,
    roundsWithoutPlayerAttack: 0,
    postMeetingBurst: false,
    ueberstundenTriggered: false,
    koffeinActive: false,
    dringlichPenalty: false,
    enemySpecialUsed: false,
    influencerHealActive: monster.id === 'monster_influencer_marketing',
  };
}

export function playerAttack(
  slotIndex: number,
  gameState: GameState,
  combatState: CombatState
): CombatState {
  const state = { ...combatState, log: [...combatState.log] };
  const slot = gameState.skillSlots[slotIndex];

  if (!slot || !slot.active) {
    state.log.push('Dieser Slot hat keinen aktiven Skill!');
    return state;
  }

  const gem = slot.active;
  const supports = slot.supports;
  const trigger = slot.trigger;
  const playerStats = gameState.player;

  // Check for Ticket-Geist special: only eskalieren works
  if (state.enemy.id === 'monster_ticketgeist_it') {
    const hasEskalieren = gem.tags?.includes('eskalieren') ?? false;
    if (!hasEskalieren) {
      state.log.push(
        `${gem.name} → Ticketsystem-Geist ignoriert das. Nur Eskalation wirkt!`
      );
      state.roundsWithoutPlayerAttack++;
      return checkTriggers(state, gameState, slotIndex);
    }
  }

  let damage = calculateDamage(gem, supports, state.enemy.department, playerStats, gameState);

  // Dringlich penalty from previous round
  if (state.dringlichPenalty) {
    damage = Math.floor(damage * 0.8);
    state.dringlichPenalty = false;
    state.log.push('Glaubwürdigkeit gesunken. –20% Schaden.');
  }

  // Check if current slot has dringlich support
  const hasDringlich = supports.some((s) => s.id === 'gem_dringlich_support');
  if (hasDringlich) {
    state.dringlichPenalty = true;
  }

  // Post-meeting burst (from trigger gem)
  if (state.postMeetingBurst) {
    const burst = trigger?.id === 'gem_postmeeting_trigger' ? trigger.effectValue : 50;
    damage = Math.floor(damage * (1 + burst / 100));
    state.postMeetingBurst = false;
    state.log.push(`Post-Meeting-Burst! +${burst}% Schaden!`);
  }

  // Überstunden trigger (low HP)
  if (trigger?.id === 'gem_ueberstunden_trigger' && !state.ueberstundenTriggered) {
    const threshold = trigger.effectValue;
    if ((state.playerHp / playerStats.maxHp) * 100 <= threshold) {
      damage = Math.floor(damage * 1.5);
      state.ueberstundenTriggered = true;
      state.log.push('Überstunden-Trigger! Man arbeitet halt weiter. +50% Schaden!');
    }
  }

  // Koffein rush
  if (state.koffeinActive && trigger?.id === 'gem_koffein_trigger') {
    damage = Math.floor(damage * (1 + trigger.effectValue / 100));
    state.koffeinActive = false;
    state.log.push(`Koffein-Rush! +${trigger.effectValue}% Schaden!`);
  }

  // Determine if immune
  const deptMod = getDepartmentModifier(gem.tags ?? [], state.enemy.department);
  const isImmune = deptMod === 'immune';

  // Apply enemy-specific special: check monster immunities directly
  const tagImmune = gem.tags?.some((t) => state.enemy.immunities.includes(t)) ?? false;
  const finalDamage = tagImmune || isImmune ? 0 : damage;

  state.enemyHp = Math.max(0, state.enemyHp - finalDamage);

  // Build log entry
  const deptModDisplay =
    deptMod === 'immune'
      ? ' [IMMUN]'
      : deptMod > 0
        ? ` [+${Math.round(deptMod * 100)}%]`
        : deptMod < 0
          ? ` [${Math.round(deptMod * 100)}%]`
          : '';
  const tagImmDisplay = tagImmune && !isImmune ? ' [TAG IMMUN]' : '';

  if (finalDamage === 0) {
    state.log.push(
      `${gem.name}${deptModDisplay}${tagImmDisplay} → Kein Effekt! Wirkungslos gegen ${state.enemy.name}.`
    );
  } else {
    state.log.push(
      `${gem.name}${deptModDisplay} → ${finalDamage} Schaden an ${state.enemy.name}.`
    );
  }

  // MfG heal
  const hasMfg = supports.some((s) => s.id === 'gem_mfg_support');
  if (hasMfg) {
    const healPct = supports.find((s) => s.id === 'gem_mfg_support')?.effectValue ?? 5;
    const healAmt = Math.floor((playerStats.maxHp * healPct) / 100);
    state.playerHp = Math.min(playerStats.maxHp, state.playerHp + healAmt);
    state.log.push(`Mit freundlichen Grüßen: +${healAmt} HP.`);
  }

  // Set post-meeting burst flag if gem has meeting-einladen tag
  if (gem.tags?.includes('meeting-einladen')) {
    const hasPmTrigger = slot.trigger?.id === 'gem_postmeeting_trigger';
    if (hasPmTrigger) {
      state.postMeetingBurst = true;
    }
  }

  // HP regen from items
  const hpRegen = getHpRegenPerRound(gameState);
  if (hpRegen > 0) {
    state.playerHp = Math.min(playerStats.maxHp, state.playerHp + hpRegen);
  }

  state.roundsWithoutPlayerAttack = 0;
  state.isPlayerTurn = false;

  return checkCombatEnd(state);
}

function checkTriggers(
  state: CombatState,
  gameState: GameState,
  _slotIndex: number
): CombatState {
  // Cast when Overlooked
  for (const slot of gameState.skillSlots) {
    if (
      slot.trigger?.id === 'gem_overlooked_trigger' &&
      slot.active &&
      state.roundsWithoutPlayerAttack >= (slot.trigger.effectValue ?? 2)
    ) {
      const gem = slot.active;
      state.log.push(
        `Cast when Overlooked: ${gem.name} löst automatisch aus!`
      );
      // Do a simplified auto-attack
      const dmg = calculateDamage(
        gem,
        slot.supports,
        state.enemy.department,
        gameState.player,
        gameState
      );
      state.enemyHp = Math.max(0, state.enemyHp - dmg);
      state.log.push(`Auto-Angriff: ${dmg} Schaden.`);
      state.roundsWithoutPlayerAttack = 0;
    }
  }
  return state;
}

export function enemyTurn(combatState: CombatState, monster: Monster, playerArmor: number): CombatState {
  const state = { ...combatState, log: [...combatState.log] };

  if (state.isOver) return state;

  // Special ability: Influencer-Beauftragter heals every round
  if (state.influencerHealActive && monster.specialAbilityName === 'Engagement-Loop') {
    const heal = Math.floor(monster.maxHp * 0.1);
    state.enemyHp = Math.min(monster.maxHp, state.enemyHp + heal);
    state.log.push(`${monster.name} "Engagement"! Heilt ${heal} HP.`);
  }

  // Special ability: HR-Bot Onboarding-Loop
  if (
    monster.id === 'monster_hrbot_onboarding' &&
    !state.enemySpecialUsed &&
    state.enemyHp < monster.maxHp * 0.3
  ) {
    const resetHp = Math.floor(monster.maxHp * 0.5);
    state.enemyHp = resetHp;
    state.enemySpecialUsed = true;
    state.log.push(`${monster.name} aktiviert Onboarding-Loop! HP auf ${resetHp} zurückgesetzt.`);
  }

  // Special ability: Senior Sysadmin Neustart
  if (
    monster.id === 'monster_seniorsysadmin_it' &&
    !state.enemySpecialUsed &&
    state.enemyHp < monster.maxHp * 0.25
  ) {
    const resetHp = Math.floor(monster.maxHp * 0.5);
    state.enemyHp = resetHp;
    state.enemySpecialUsed = true;
    state.log.push(`${monster.name} führt NEUSTART durch! HP auf ${resetHp} zurückgesetzt.`);
  }

  // Special ability: CEO Synergien (every 3 rounds)
  if (monster.id === 'monster_ceo_chef' && state.round % 3 === 0) {
    const heal = Math.floor(monster.maxHp * 0.05);
    state.enemyHp = Math.min(monster.maxHp, state.enemyHp + heal);
    state.log.push(`${monster.name}: "Synergien!" +${heal} HP, Schaden steigt.`);
  }

  // Special ability: Head of Brand Rebrand (every 3 rounds)
  if (monster.id === 'monster_headofbrand_marketing' && state.round % 3 === 0) {
    state.log.push(`${monster.name} rebrandet! Resistenzen wechseln!`);
    // This is cosmetic—the actual resistance change would need mutable monster state
  }

  // Enemy attack
  const dmg = enemyAttack(monster, playerArmor);
  state.playerHp = Math.max(0, state.playerHp - dmg);
  state.log.push(`${monster.name} greift an: ${dmg} Schaden.`);

  state.round++;
  state.isPlayerTurn = true;

  return checkCombatEnd(state);
}

export function checkCombatEnd(combatState: CombatState): CombatState {
  const state = { ...combatState };

  if (state.enemyHp <= 0) {
    state.isOver = true;
    state.playerWon = true;
    state.log.push(`${state.enemy.name} wurde besiegt!`);
  } else if (state.playerHp <= 0) {
    state.isOver = true;
    state.playerWon = false;
    state.playerHp = 0;
    state.log.push('Du wurdest besiegt. Game Over.');
  }

  return state;
}
