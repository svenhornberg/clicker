// main.ts — game entry point and state machine
import type {
  GameState,
  CombatState,
  SkillSlot,
  EquipmentSlots,
  Monster,
  MetaState,
} from './core/types';
import { GameUI } from './ui/GameUI';
import { createFloors } from './data/floors';
import { activeGems } from './data/gems';
import { allMetaUpgrades } from './data/metaUpgrades';
import {
  initCombatAuto,
  tickCombat,
  playerAttackManual,
  enemyTurn,
  checkCombatEnd,
} from './systems/CombatSystem';
import {
  generateLoot,
  generatePrinterLoot,
  getShopItems,
  getShopGems,
} from './systems/LootSystem';
import { findFusionPairs, fuseGems } from './systems/GemFusionSystem';
import { saveGame, loadGame, deleteSave, hasSave, saveMeta, loadMeta } from './utils/save';
import { chance } from './utils/random';
import { calculateStats, getGoldBonusPerCombat } from './systems/StatsSystem';
import {
  createDefaultMetaState,
  calculateBetriebsjahre,
  applyMetaUpgrades,
  purchaseUpgrade,
} from './systems/MetaSystem';

// ─── Initial State ────────────────────────────────────────────────────────────

function makeEmptyEquipment(): EquipmentSlots {
  return {
    helm: null,
    weapon: null,
    offhand: null,
    armor: null,
    gloves: null,
    shoes: null,
    amulet: null,
    ring1: null,
    ring2: null,
  };
}

function makeInitialSkillSlots(): SkillSlot[] {
  const buzzword = { ...activeGems.find((g) => g.id === 'gem_buzzword_active')! };
  const meeting = { ...activeGems.find((g) => g.id === 'gem_meeting_active')! };
  return [
    { active: buzzword, supports: [], trigger: null },
    { active: meeting, supports: [], trigger: null },
    { active: null, supports: [], trigger: null },
  ];
}

function createNewGame(): GameState {
  return {
    player: {
      hp: 100,
      maxHp: 100,
      armor: 5,
      attackSpeed: 100,
      critChance: 5,
      escapeChance: 10,
      gold: 50,
      concentration: 10,
    },
    equipment: makeEmptyEquipment(),
    skillSlots: makeInitialSkillSlots(),
    inventory: [],
    gemInventory: [],
    currentFloor: 1,
    currentRoom: 0,
    defeatedMonsters: [],
    visitedRooms: [],
    phase: 'map',
  };
}

// ─── Game Manager ─────────────────────────────────────────────────────────────

class GameManager {
  private state: GameState;
  private combatState: CombatState | null = null;
  private floors = createFloors();
  private ui: GameUI;
  private metaState: MetaState;
  private runFloorsCleared = 0;
  private runBossesDefeated = 0;
  private combatInterval: number | null = null;

  constructor() {
    this.metaState = loadMeta() ?? createDefaultMetaState();
    const saved = hasSave() ? loadGame() : null;
    this.state = saved ?? createNewGame();
    this.ui = new GameUI(this.state, this.handleAction.bind(this));
    this.ui.setFloors(this.floors);
    this.render();
  }

  private getCurrentFloor() {
    return this.floors[this.state.currentFloor - 1];
  }

  private save() {
    saveGame(this.state);
  }

  private saveMetaState() {
    saveMeta(this.metaState);
  }

  private setState(partial: Partial<GameState>) {
    this.state = { ...this.state, ...partial };
    this.ui.update(this.state);
    this.save();
  }

  private render() {
    this.ui.update(this.state);
    if (this.state.phase === 'meta') {
      this.ui.renderMeta(this.metaState, allMetaUpgrades);
    } else {
      this.ui.render(this.combatState ?? undefined);
    }
  }

  // ─── Combat Loop ──────────────────────────────────────────────────────────

  startCombatLoop() {
    if (this.combatInterval) clearInterval(this.combatInterval);
    this.combatInterval = setInterval(() => {
      if (this.state.phase !== 'combat' || !this.combatState) return;
      this.combatState = tickCombat(this.combatState, this.state, this.metaState, 100);

      if (this.combatState.playerHp !== this.state.player.hp) {
        this.state = {
          ...this.state,
          player: { ...this.state.player, hp: this.combatState.playerHp },
        };
        this.ui.update(this.state);
      }

      this.ui.render(this.combatState);

      if (this.combatState.isOver) {
        this.stopCombatLoop();
        this.handleCombatEnd();
      }
    }, 100) as unknown as number;
  }

  stopCombatLoop() {
    if (this.combatInterval) {
      clearInterval(this.combatInterval);
      this.combatInterval = null;
    }
  }

  private handleCombatEnd() {
    if (!this.combatState) return;

    if (this.combatState.playerWon) {
      if (this.combatState.enemy.isBoss) {
        this.runBossesDefeated++;
      }
      this.render();
    } else {
      this.endRun(false);
      this.setState({ phase: 'gameover' });
      this.render();
    }
  }

  private endRun(won: boolean) {
    const finalHpPercent = (this.state.player.hp / this.state.player.maxHp) * 100;
    const earned = calculateBetriebsjahre(
      this.runFloorsCleared,
      this.runBossesDefeated,
      won,
      finalHpPercent
    );

    this.metaState = {
      ...this.metaState,
      betriebsjahre: this.metaState.betriebsjahre + earned,
      totalRuns: this.metaState.totalRuns + 1,
      victories: won ? this.metaState.victories + 1 : this.metaState.victories,
      highestFloorReached: Math.max(this.metaState.highestFloorReached, this.state.currentFloor),
    };
    this.saveMetaState();

    this.runFloorsCleared = 0;
    this.runBossesDefeated = 0;
  }

  private handleAction(action: string, data?: unknown): void {
    const d = data as Record<string, unknown> | undefined;

    switch (action) {
      case 'new-game':
        this.newGame();
        break;

      case 'enter-room':
        this.enterRoom(d?.roomIndex as number);
        break;

      case 'player-attack':
        this.doPlayerAttackManual(d?.slotIndex as number);
        break;

      case 'enemy-turn':
        this.doEnemyTurn();
        break;

      case 'escape':
        this.doEscape();
        break;

      case 'collect-loot':
        this.collectLoot();
        break;

      case 'take-gem':
        this.takeGem(d?.gemIndex as number);
        break;

      case 'equip-item':
        this.equipItem(d?.itemIndex as number);
        break;

      case 'continue-from-loot':
        this.continueFromLoot();
        break;

      case 'leave-shop':
        this.leaveShop();
        break;

      case 'buy-item':
        this.buyItem(d?.itemIndex as number, d?.price as number);
        break;

      case 'buy-gem':
        this.buyGem(d?.gemIndex as number, d?.price as number);
        break;

      case 'rest-heal':
        this.restHeal(d?.healAmount as number);
        break;

      case 'use-printer':
        this.usePrinter();
        break;

      case 'skip-printer':
        this.skipPrinter();
        break;

      case 'assign-gem':
        this.assignGem(
          d?.gemIndex as number,
          d?.slotIndex as number,
          d?.role as string
        );
        break;

      case 'remove-gem':
        this.removeGemFromSlot(
          d?.slotIndex as number,
          d?.role as string,
          d?.supportIndex as number | undefined
        );
        break;

      case 'move-gem':
        this.moveGemBetweenSlots(
          d?.fromSlot as number,
          d?.fromRole as string,
          d?.fromSupportIndex as number | undefined,
          d?.toSlot as number,
          d?.toRole as string
        );
        break;

      case 'fuse-gems':
        this.fuseGemPair(d?.pairIndex as number);
        break;

      case 'open-gem-manager':
        this.ui.renderGemManager();
        break;

      case 'game-over':
        this.endRun(false);
        this.setState({ phase: 'gameover' });
        this.render();
        break;

      case 'go-to-meta':
        this.setState({ phase: 'meta' });
        this.render();
        break;

      case 'purchase-upgrade':
        this.purchaseMetaUpgrade(d?.upgradeId as string);
        break;
    }
  }

  private newGame() {
    this.stopCombatLoop();
    deleteSave();
    this.floors = createFloors();
    let freshState = createNewGame();
    freshState = applyMetaUpgrades(freshState, this.metaState);
    this.state = freshState;
    this.combatState = null;
    this.runFloorsCleared = 0;
    this.runBossesDefeated = 0;
    this.ui.setFloors(this.floors);
    this.setState({ phase: 'map' });
    this.render();
  }

  private enterRoom(roomIndex: number) {
    const floor = this.getCurrentFloor();
    if (!floor) return;

    const room = floor.rooms[roomIndex];
    if (!room || (!room.available && roomIndex !== this.state.currentRoom)) return;

    this.setState({ currentRoom: roomIndex });
    const r = floor.rooms[roomIndex];

    switch (r.type) {
      case 'combat':
      case 'elite':
      case 'boss':
        if (r.monster) {
          this.startCombat(r.monster);
        }
        break;

      case 'rest':
        this.setState({ phase: 'rest' });
        this.markRoomVisited(roomIndex);
        this.render();
        break;

      case 'shop': {
        const shopItems = getShopItems(this.state.currentFloor);
        const shopGems = getShopGems(this.state.currentFloor);
        this.setState({
          phase: 'shop',
          shopItems,
          shopGems,
          shopPurchased: [],
        });
        this.markRoomVisited(roomIndex);
        this.render();
        break;
      }

      case 'printer':
        this.setState({ phase: 'printer' });
        this.render();
        break;
    }
  }

  private startCombat(monster: Monster) {
    const stats = calculateStats(this.state);
    this.combatState = initCombatAuto(monster, stats, this.metaState);
    this.setState({ phase: 'combat', pendingMonster: monster });
    this.render();
    this.startCombatLoop();
  }

  private doPlayerAttackManual(slotIndex: number) {
    if (!this.combatState || this.combatState.isOver) return;
    this.combatState = playerAttackManual(slotIndex, this.state, this.combatState, this.metaState);
    this.render();
    if (this.combatState.isOver) {
      this.stopCombatLoop();
      this.handleCombatEnd();
    }
  }

  private doEnemyTurn() {
    if (!this.combatState || this.combatState.isOver) return;

    const stats = calculateStats(this.state);
    this.combatState = enemyTurn(
      this.combatState,
      this.combatState.enemy,
      stats.armor
    );
    this.combatState = checkCombatEnd(this.combatState);

    this.setState({
      player: {
        ...this.state.player,
        hp: this.combatState.playerHp,
      },
    });

    if (this.combatState.isOver && !this.combatState.playerWon) {
      this.endRun(false);
      this.setState({ phase: 'gameover' });
    }

    this.render();
  }

  private doEscape() {
    const stats = calculateStats(this.state);
    if (chance(stats.escapeChance / 100)) {
      this.stopCombatLoop();
      this.combatState = null;
      this.setState({ phase: 'map', pendingMonster: undefined });
      this.render();
    } else {
      if (this.combatState && this.state.pendingMonster) {
        const stats2 = calculateStats(this.state);
        this.combatState = enemyTurn(
          this.combatState,
          this.state.pendingMonster,
          stats2.armor
        );
        const updatedHp = this.combatState.playerHp;
        this.setState({ player: { ...this.state.player, hp: updatedHp } });

        if (this.combatState.isOver && !this.combatState.playerWon) {
          this.stopCombatLoop();
          this.endRun(false);
          this.setState({ phase: 'gameover' });
        }
        this.render();
      }
    }
  }

  private collectLoot() {
    if (!this.combatState) return;

    const monster = this.combatState.enemy;
    const floor = this.state.currentFloor;
    const loot = generateLoot(monster, floor);

    loot.gold += getGoldBonusPerCombat(this.state);

    const newGold = this.state.player.gold + loot.gold;
    const newDefeated = [...this.state.defeatedMonsters, monster.id];

    this.markRoomVisited(this.state.currentRoom);

    this.setState({
      phase: 'loot',
      pendingLoot: loot,
      pendingMonster: undefined,
      player: { ...this.state.player, gold: newGold },
      defeatedMonsters: newDefeated,
    });

    this.combatState = null;
    this.render();
  }

  private takeGem(gemIndex: number) {
    const loot = this.state.pendingLoot;
    if (!loot || gemIndex >= loot.gems.length) return;

    const gem = loot.gems[gemIndex];
    const newGemInventory = [...this.state.gemInventory, { ...gem }];
    const newLootGems = loot.gems.filter((_, i) => i !== gemIndex);

    this.setState({
      gemInventory: newGemInventory,
      pendingLoot: { ...loot, gems: newLootGems },
    });
    this.render();
  }

  private equipItem(itemIndex: number) {
    const loot = this.state.pendingLoot;
    if (!loot || itemIndex >= loot.items.length) return;

    const item = loot.items[itemIndex];
    const newEquipment = { ...this.state.equipment };
    const slot = item.slot;

    const oldItem = newEquipment[slot];
    const newInventory = [...this.state.inventory];
    if (oldItem) newInventory.push(oldItem);

    newEquipment[slot] = item;
    const newLootItems = loot.items.filter((_, i) => i !== itemIndex);

    this.setState({
      equipment: newEquipment,
      inventory: newInventory,
      pendingLoot: { ...loot, items: newLootItems },
    });
    this.render();
  }

  private continueFromLoot() {
    this.setState({ phase: 'map', pendingLoot: undefined });
    this.advanceRooms();
    this.render();
  }

  private advanceRooms() {
    const floor = this.getCurrentFloor();
    if (!floor) return;

    const allCleared = floor.rooms.every(
      (r) => this.state.visitedRooms.includes(r.id)
    );

    if (allCleared) {
      this.runFloorsCleared++;

      if (this.state.currentFloor >= 10) {
        this.endRun(true);
        this.setState({ phase: 'victory' });
        return;
      }
      const nextFloor = this.state.currentFloor + 1;
      this.floors[nextFloor - 1].rooms[0].available = true;
      this.setState({ currentFloor: nextFloor, currentRoom: 0 });
    } else {
      this.unlockNextRooms();
    }
  }

  private unlockNextRooms() {
    const floor = this.getCurrentFloor();
    if (!floor) return;

    const rooms = floor.rooms;
    const currentIdx = this.state.currentRoom;
    const cleared = this.state.visitedRooms;

    for (let i = 0; i < rooms.length; i++) {
      if (!cleared.includes(rooms[i].id)) {
        rooms[i].available = true;
        break;
      }
    }

    rooms.forEach((r, i) => {
      if (i <= currentIdx || cleared.includes(r.id)) {
        r.available = true;
      }
    });
  }

  private markRoomVisited(roomIndex: number) {
    const floor = this.getCurrentFloor();
    if (!floor) return;

    const room = floor.rooms[roomIndex];
    if (!room) return;

    if (!this.state.visitedRooms.includes(room.id)) {
      const newVisited = [...this.state.visitedRooms, room.id];
      this.setState({ visitedRooms: newVisited });
    }

    if (roomIndex + 1 < floor.rooms.length) {
      floor.rooms[roomIndex + 1].available = true;
    }
  }

  private leaveShop() {
    this.setState({ phase: 'map', shopItems: undefined, shopGems: undefined });
    this.render();
  }

  private buyItem(itemIndex: number, price: number) {
    const shopItems = this.state.shopItems;
    if (!shopItems || itemIndex >= shopItems.length) return;
    if (this.state.player.gold < price) return;

    const item = shopItems[itemIndex];
    const newEquipment = { ...this.state.equipment };
    const oldItem = newEquipment[item.slot];
    const newInventory = [...this.state.inventory];
    if (oldItem) newInventory.push(oldItem);
    newEquipment[item.slot] = item;

    const purchased = [...(this.state.shopPurchased ?? []), `item_${itemIndex}`];

    this.setState({
      equipment: newEquipment,
      inventory: newInventory,
      player: { ...this.state.player, gold: this.state.player.gold - price },
      shopPurchased: purchased,
    });
    this.render();
  }

  private buyGem(gemIndex: number, price: number) {
    const shopGems = this.state.shopGems;
    if (!shopGems || gemIndex >= shopGems.length) return;
    if (this.state.player.gold < price) return;

    const gem = { ...shopGems[gemIndex] };
    const purchased = [...(this.state.shopPurchased ?? []), `gem_${gemIndex}`];

    this.setState({
      gemInventory: [...this.state.gemInventory, gem],
      player: { ...this.state.player, gold: this.state.player.gold - price },
      shopPurchased: purchased,
    });
    this.render();
  }

  private restHeal(healAmount: number) {
    const actual = Math.min(healAmount, this.state.player.maxHp - this.state.player.hp);
    const newHp = this.state.player.hp + actual;

    this.markRoomVisited(this.state.currentRoom);

    this.setState({
      phase: 'map',
      player: { ...this.state.player, hp: newHp },
    });
    this.advanceRooms();
    this.render();
  }

  private usePrinter() {
    const loot = generatePrinterLoot(this.state.currentFloor);

    this.markRoomVisited(this.state.currentRoom);

    if (loot.isDamageEvent) {
      const dmg = loot.damageAmount ?? 10;
      const newHp = Math.max(1, this.state.player.hp - dmg);
      this.setState({ player: { ...this.state.player, hp: newHp } });

      if (newHp <= 0) {
        this.endRun(false);
        this.setState({ phase: 'gameover' });
        this.render();
        return;
      }

      this.setState({
        phase: 'loot',
        pendingLoot: {
          ...loot,
          message: `💥 ${loot.message}`,
        },
      });
    } else {
      this.setState({
        phase: 'loot',
        pendingLoot: loot,
      });
    }

    this.advanceRooms();
    this.render();
  }

  private skipPrinter() {
    this.markRoomVisited(this.state.currentRoom);
    this.setState({ phase: 'map' });
    this.advanceRooms();
    this.render();
  }

  private assignGem(gemIndex: number, slotIndex: number, role: string) {
    const gem = this.state.gemInventory[gemIndex];
    if (!gem) return;
    if (gem.role !== role) return;

    const newSlots = this.state.skillSlots.map((s) => ({ ...s, supports: [...s.supports] }));
    const slot = newSlots[slotIndex];
    if (!slot) return;

    if (role === 'active') {
      const newGemInv = [...this.state.gemInventory];
      if (slot.active) newGemInv.push(slot.active);
      slot.active = gem;
      newGemInv.splice(gemIndex, 1);
      this.setState({ skillSlots: newSlots, gemInventory: newGemInv });
    } else if (role === 'support') {
      if (slot.supports.length >= 3) {
        const newGemInv = [...this.state.gemInventory];
        newGemInv.push(slot.supports[0]);
        slot.supports[0] = gem;
        newGemInv.splice(gemIndex, 1);
        this.setState({ skillSlots: newSlots, gemInventory: newGemInv });
      } else {
        slot.supports.push(gem);
        const newGemInv = [...this.state.gemInventory];
        newGemInv.splice(gemIndex, 1);
        this.setState({ skillSlots: newSlots, gemInventory: newGemInv });
      }
    } else if (role === 'trigger') {
      const newGemInv = [...this.state.gemInventory];
      if (slot.trigger) newGemInv.push(slot.trigger);
      slot.trigger = gem;
      newGemInv.splice(gemIndex, 1);
      this.setState({ skillSlots: newSlots, gemInventory: newGemInv });
    }

    this.render();
  }

  private removeGemFromSlot(slotIndex: number, role: string, supportIndex?: number) {
    const newSlots = this.state.skillSlots.map((s) => ({ ...s, supports: [...s.supports] }));
    const slot = newSlots[slotIndex];
    if (!slot) return;
    const newGemInv = [...this.state.gemInventory];

    if (role === 'active' && slot.active) {
      newGemInv.push(slot.active);
      slot.active = null;
    } else if (role === 'support' && supportIndex !== undefined && slot.supports[supportIndex]) {
      newGemInv.push(slot.supports[supportIndex]);
      slot.supports.splice(supportIndex, 1);
    } else if (role === 'trigger' && slot.trigger) {
      newGemInv.push(slot.trigger);
      slot.trigger = null;
    }

    this.setState({ skillSlots: newSlots, gemInventory: newGemInv });
    this.render();
  }

  private moveGemBetweenSlots(
    fromSlot: number,
    fromRole: string,
    fromSupportIndex: number | undefined,
    toSlot: number,
    toRole: string
  ) {
    // Extract gem from source slot into a temp inventory, then assign to target
    const newSlots = this.state.skillSlots.map((s) => ({ ...s, supports: [...s.supports] }));
    const src = newSlots[fromSlot];
    if (!src) return;

    let gem = null;
    if (fromRole === 'active') { gem = src.active; src.active = null; }
    else if (fromRole === 'support' && fromSupportIndex !== undefined) {
      gem = src.supports[fromSupportIndex];
      src.supports.splice(fromSupportIndex, 1);
    } else if (fromRole === 'trigger') { gem = src.trigger; src.trigger = null; }

    if (!gem || gem.role !== toRole) {
      // Invalid move — abort (restore by not applying)
      return;
    }

    const dst = newSlots[toSlot];
    if (!dst) return;
    const newGemInv = [...this.state.gemInventory];

    if (toRole === 'active') {
      if (dst.active) newGemInv.push(dst.active);
      dst.active = gem;
    } else if (toRole === 'support') {
      if (dst.supports.length >= 3) { newGemInv.push(dst.supports[0]); dst.supports[0] = gem; }
      else dst.supports.push(gem);
    } else if (toRole === 'trigger') {
      if (dst.trigger) newGemInv.push(dst.trigger);
      dst.trigger = gem;
    }

    this.setState({ skillSlots: newSlots, gemInventory: newGemInv });
    this.render();
  }

  private fuseGemPair(pairIndex: number) {
    const pairs = findFusionPairs(this.state.gemInventory);
    if (pairIndex >= pairs.length) return;

    const [g1, g2] = pairs[pairIndex];
    const fused = fuseGems(g1, g2);

    const newInv = [...this.state.gemInventory];
    const idx1 = newInv.findIndex((g) => g === g1);
    if (idx1 !== -1) newInv.splice(idx1, 1);
    const idx2 = newInv.findIndex((g) => g === g2);
    if (idx2 !== -1) newInv.splice(idx2, 1);
    newInv.push(fused);

    this.setState({ gemInventory: newInv });
    this.render();
  }

  private purchaseMetaUpgrade(upgradeId: string) {
    this.metaState = purchaseUpgrade(this.metaState, upgradeId);
    this.saveMetaState();
    this.render();
  }
}

// ─── Title Screen ─────────────────────────────────────────────────────────────

function showTitleScreen(onStart: (continueGame: boolean) => void) {
  const root = document.getElementById('game-root');
  if (!root) return;

  const hasSaveGame = hasSave();

  root.innerHTML = `
    <div class="title-screen">
      <div class="title-logo">
        <div class="title-main">GemRogue</div>
        <div class="title-sub">Überstunden bis zum Endboss</div>
      </div>
      <div class="title-tagline">
        Ein Auto-Battler Roguelite im Büroalltag<br>
        <em>Bewaffnet mit Buzzwords, Kaffee und einer mechanischen Tastatur.</em>
      </div>
      <div class="title-buttons">
        ${hasSaveGame
          ? '<button id="btn-continue" class="title-btn primary">▶ Weiterspielen</button>'
          : ''}
        <button id="btn-new" class="title-btn ${hasSaveGame ? 'secondary' : 'primary'}">
          ${hasSaveGame ? '🔄 Neues Spiel' : '▶ Spiel starten'}
        </button>
      </div>
      <div class="title-floor-preview">
        <div class="floor-hint">🏢 Etage 1: Onboarding → Chefetage (10)</div>
      </div>
    </div>
  `;

  document.getElementById('btn-continue')?.addEventListener('click', () => {
    onStart(true);
  });
  document.getElementById('btn-new')?.addEventListener('click', () => {
    if (hasSaveGame) {
      const confirmed = confirm('Neues Spiel starten? Der aktuelle Fortschritt wird gelöscht.');
      if (!confirmed) return;
      deleteSave();
    }
    onStart(false);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

function boot() {
  const loading = document.getElementById('loading-screen');
  if (loading) {
    setTimeout(() => {
      loading.style.opacity = '0';
      setTimeout(() => {
        loading.remove();
        showTitleScreen((_continueGame: boolean) => {
          new GameManager();
        });
      }, 400);
    }, 800);
  } else {
    showTitleScreen((_continueGame: boolean) => {
      new GameManager();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
