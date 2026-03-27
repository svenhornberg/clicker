// GameUI.ts — DOM rendering, no game logic
import type {
  GameState,
  CombatState,
  LootResult,
  Room,
  Gem,
  Item,
  Department,
} from '../core/types';
import { DEPARTMENT_NAMES, ROOM_TYPE_LABELS } from '../data/floors';
import { getItemShopPrice, getGemShopPrice } from '../systems/LootSystem';
import { findFusionPairs } from '../systems/GemFusionSystem';

const DEPT_COLORS: Record<Department, string> = {
  onboarding: '#6b7280',
  marketing: '#ec4899',
  produkt: '#3b82f6',
  controlling: '#10b981',
  it: '#8b5cf6',
  chefetage: '#f59e0b',
};

const ROOM_ICONS: Record<Room['type'], string> = {
  combat: '⚔️',
  elite: '🏆',
  rest: '☕',
  shop: '🛒',
  printer: '🖨️',
  boss: '👔',
};

export class GameUI {
  private container: HTMLElement;
  private gameState: GameState;
  private onAction: (action: string, data?: unknown) => void;
  private currentFloors: ReturnType<typeof import('../data/floors').createFloors> | null = null;

  constructor(
    gameState: GameState,
    onAction: (action: string, data?: unknown) => void
  ) {
    this.gameState = gameState;
    this.onAction = onAction;
    const el = document.getElementById('game-root');
    if (!el) throw new Error('game-root element not found');
    this.container = el;
  }

  setFloors(floors: ReturnType<typeof import('../data/floors').createFloors>): void {
    this.currentFloors = floors;
  }

  update(gameState: GameState): void {
    this.gameState = gameState;
  }

  render(combatState?: CombatState): void {
    this.container.innerHTML = '';

    switch (this.gameState.phase) {
      case 'map':
        this.renderMap();
        break;
      case 'combat':
        if (combatState) this.renderCombat(combatState);
        break;
      case 'loot':
        if (this.gameState.pendingLoot) this.renderLoot(this.gameState.pendingLoot);
        break;
      case 'shop':
        this.renderShop();
        break;
      case 'rest':
        this.renderRest();
        break;
      case 'printer':
        this.renderPrinter();
        break;
      case 'gameover':
        this.renderGameOver();
        break;
      case 'victory':
        this.renderVictory();
        break;
    }
  }

  renderMap(): void {
    const floor = this.currentFloors?.[this.gameState.currentFloor - 1];
    if (!floor) return;

    const dept = floor.department;
    const color = DEPT_COLORS[dept];

    const wrapper = this.el('div', 'map-wrapper');

    // Header
    const header = this.el('div', 'map-header');
    header.style.borderBottomColor = color;
    header.innerHTML = `
      <div class="floor-title">
        <span class="floor-num">Etage ${floor.floorNumber}</span>
        <span class="floor-dept" style="color:${color}">${DEPARTMENT_NAMES[dept]}</span>
      </div>
      <div class="player-status">
        <span class="hp-display">❤️ ${this.gameState.player.hp}/${this.gameState.player.maxHp}</span>
        <span class="gold-display">💰 ${this.gameState.player.gold}</span>
      </div>
    `;
    wrapper.appendChild(header);

    // Rooms
    const roomsContainer = this.el('div', 'rooms-container');
    floor.rooms.forEach((room, idx) => {
      const card = this.el('div', `room-card ${room.type}-room`);
      const isCleared = this.gameState.visitedRooms.includes(room.id);
      const isCurrent = idx === this.gameState.currentRoom;
      const isAvail = room.available || isCurrent;

      if (isCleared) card.classList.add('cleared');
      if (isCurrent) card.classList.add('current');
      if (!isAvail) card.classList.add('locked');
      if (isAvail && !isCleared) card.classList.add('available');

      card.innerHTML = `
        <div class="room-icon">${ROOM_ICONS[room.type]}</div>
        <div class="room-label">${ROOM_TYPE_LABELS[room.type]}</div>
        ${room.monster ? `<div class="room-monster">${room.monster.name}</div>` : ''}
        ${isCleared ? '<div class="cleared-badge">✓</div>' : ''}
        ${room.type === 'boss' ? `<div class="boss-warning" style="color:${color}">BOSS</div>` : ''}
      `;

      if (isAvail && !isCleared) {
        card.addEventListener('click', () => {
          this.onAction('enter-room', { roomIndex: idx });
        });
      }

      roomsContainer.appendChild(card);
    });
    wrapper.appendChild(roomsContainer);

    // Inventory panel (compact)
    const invPanel = this.renderCompactInventory();
    wrapper.appendChild(invPanel);

    // Skill slots
    const skillsPanel = this.renderSkillSlots();
    wrapper.appendChild(skillsPanel);

    this.container.appendChild(wrapper);
  }

  renderCombat(combatState: CombatState): void {
    const enemy = combatState.enemy;
    const dept = enemy.department;
    const color = DEPT_COLORS[dept];

    const wrapper = this.el('div', 'combat-wrapper');

    // Enemy panel
    const enemyPanel = this.el('div', 'enemy-panel');
    enemyPanel.style.borderColor = color;

    const enemyHpPct = Math.max(0, (combatState.enemyHp / enemy.maxHp) * 100);
    enemyPanel.innerHTML = `
      <div class="enemy-header">
        <span class="enemy-name" style="color:${color}">${enemy.name}</span>
        ${enemy.isBoss ? '<span class="boss-badge">BOSS</span>' : ''}
        <span class="enemy-dept">${DEPARTMENT_NAMES[dept]}</span>
      </div>
      <div class="hp-bar-container">
        <div class="hp-bar" style="width:${enemyHpPct}%;background:${color}"></div>
        <span class="hp-text">${combatState.enemyHp}/${enemy.maxHp}</span>
      </div>
      ${enemy.specialAbilityName
        ? `<div class="special-ability">⚡ ${enemy.specialAbilityName}: ${enemy.specialAbilityDescription}</div>`
        : ''}
      <div class="enemy-tags">
        <span class="tag weakness">Schwach: ${enemy.weaknesses.join(', ') || 'keine'}</span>
        <span class="tag resist">Resistenz: ${enemy.resistances.join(', ') || 'keine'}</span>
        ${enemy.immunities.length > 0 ? `<span class="tag immune">Immun: ${enemy.immunities.join(', ')}</span>` : ''}
      </div>
      <div class="enemy-flavor">${enemy.flavorText}</div>
    `;
    wrapper.appendChild(enemyPanel);

    // Player status
    const playerPanel = this.el('div', 'player-panel');
    const playerHpPct = Math.max(
      0,
      (combatState.playerHp / this.gameState.player.maxHp) * 100
    );
    playerPanel.innerHTML = `
      <div class="player-header">
        <span>Du (Etage ${this.gameState.currentFloor})</span>
        <span class="gold-display">💰 ${this.gameState.player.gold}</span>
      </div>
      <div class="hp-bar-container">
        <div class="hp-bar player-hp-bar" style="width:${playerHpPct}%"></div>
        <span class="hp-text">${combatState.playerHp}/${this.gameState.player.maxHp}</span>
      </div>
    `;
    wrapper.appendChild(playerPanel);

    // Combat log
    const logEl = this.el('div', 'combat-log');
    const logLines = combatState.log.slice(-10);
    logEl.innerHTML = logLines
      .map((line) => `<div class="log-line">${this.escHtml(line)}</div>`)
      .join('');
    wrapper.appendChild(logEl);

    // Skill buttons
    if (!combatState.isOver && combatState.isPlayerTurn) {
      const skillsEl = this.el('div', 'combat-skills');
      skillsEl.innerHTML = '<div class="skills-title">Dein Zug — wähle eine Attacke:</div>';

      this.gameState.skillSlots.forEach((slot, idx) => {
        if (!slot.active) return;
        const btn = this.el('button', 'skill-btn');
        const gem = slot.active;
        const tags = gem.tags?.join(', ') ?? '';
        btn.innerHTML = `
          <span class="skill-name">${gem.name}</span>
          <span class="skill-tags">${tags}</span>
          ${slot.supports.length > 0
            ? `<span class="skill-supports">${slot.supports.map((s) => s.name).join(' + ')}</span>`
            : ''}
          ${slot.trigger ? `<span class="skill-trigger">⚡ ${slot.trigger.name}</span>` : ''}
          <span class="skill-dmg">~${gem.effectValue * gem.level} dmg</span>
        `;
        btn.addEventListener('click', () => {
          this.onAction('player-attack', { slotIndex: idx });
        });
        skillsEl.appendChild(btn);
      });

      // Escape option
      const escBtn = this.el('button', 'escape-btn');
      escBtn.textContent = '🏃 Fliehen';
      escBtn.addEventListener('click', () => this.onAction('escape'));
      skillsEl.appendChild(escBtn);

      wrapper.appendChild(skillsEl);
    } else if (combatState.isOver) {
      const resultEl = this.el('div', 'combat-result');
      if (combatState.playerWon) {
        resultEl.innerHTML = `<div class="victory-msg">Gewonnen! 🎉</div>`;
        const continueBtn = this.el('button', 'continue-btn');
        continueBtn.textContent = 'Beute einsammeln →';
        continueBtn.addEventListener('click', () => this.onAction('collect-loot'));
        resultEl.appendChild(continueBtn);
      } else {
        resultEl.innerHTML = `<div class="defeat-msg">Niederlage... 😔</div>`;
        const gameOverBtn = this.el('button', 'gameover-btn');
        gameOverBtn.textContent = 'Game Over';
        gameOverBtn.addEventListener('click', () => this.onAction('game-over'));
        resultEl.appendChild(gameOverBtn);
      }
      wrapper.appendChild(resultEl);
    } else if (!combatState.isPlayerTurn) {
      const waitEl = this.el('div', 'enemy-turn-indicator');
      waitEl.textContent = `${enemy.name} ist dran...`;
      const enemyBtn = this.el('button', 'continue-btn');
      enemyBtn.textContent = 'Weiter →';
      enemyBtn.addEventListener('click', () => this.onAction('enemy-turn'));
      wrapper.appendChild(waitEl);
      wrapper.appendChild(enemyBtn);
    }

    // Round info
    const roundEl = this.el('div', 'round-info');
    roundEl.textContent = `Runde ${combatState.round}`;
    wrapper.appendChild(roundEl);

    this.container.appendChild(wrapper);
  }

  renderLoot(loot: LootResult): void {
    const wrapper = this.el('div', 'loot-wrapper');
    wrapper.innerHTML = `<h2 class="loot-title">🎁 Beute</h2>`;

    if (loot.message) {
      const msg = this.el('div', 'loot-message');
      msg.textContent = loot.message;
      wrapper.appendChild(msg);
    }

    // Gold
    if (loot.gold > 0) {
      const goldEl = this.el('div', 'loot-gold');
      goldEl.innerHTML = `💰 <strong>+${loot.gold} Gold</strong>`;
      wrapper.appendChild(goldEl);
    }

    // Gems
    if (loot.gems.length > 0) {
      const gemsEl = this.el('div', 'loot-section');
      gemsEl.innerHTML = '<div class="section-title">Gems gefunden:</div>';
      loot.gems.forEach((gem, idx) => {
        const card = this.renderGemCard(gem);
        const takeBtn = this.el('button', 'take-btn');
        takeBtn.textContent = 'Nehmen';
        takeBtn.addEventListener('click', () => {
          this.onAction('take-gem', { gemIndex: idx });
        });
        card.appendChild(takeBtn);
        gemsEl.appendChild(card);
      });
      wrapper.appendChild(gemsEl);
    }

    // Items
    if (loot.items.length > 0) {
      const itemsEl = this.el('div', 'loot-section');
      itemsEl.innerHTML = '<div class="section-title">Items gefunden:</div>';
      loot.items.forEach((item, idx) => {
        const card = this.renderItemCard(item);
        const equipBtn = this.el('button', 'take-btn');
        equipBtn.textContent = 'Ausrüsten';
        equipBtn.addEventListener('click', () => {
          this.onAction('equip-item', { itemIndex: idx });
        });
        card.appendChild(equipBtn);
        itemsEl.appendChild(card);
      });
      wrapper.appendChild(itemsEl);
    }

    // Gem fusion check
    const fusionPairs = findFusionPairs(this.gameState.gemInventory);
    if (fusionPairs.length > 0) {
      const fusionEl = this.el('div', 'loot-section fusion-section');
      fusionEl.innerHTML = '<div class="section-title">⚗️ Fusion möglich!</div>';
      fusionPairs.forEach(([g1, g2], idx) => {
        const btn = this.el('button', 'fusion-btn');
        btn.innerHTML = `${g1.name} Lv${g1.level} + ${g2.name} Lv${g2.level} → Lv${g1.level + 1}`;
        btn.addEventListener('click', () => {
          this.onAction('fuse-gems', { pairIndex: idx });
        });
        fusionEl.appendChild(btn);
      });
      wrapper.appendChild(fusionEl);
    }

    // Continue button
    const continueBtn = this.el('button', 'continue-btn big-btn');
    continueBtn.textContent = 'Weiter →';
    continueBtn.addEventListener('click', () => this.onAction('continue-from-loot'));
    wrapper.appendChild(continueBtn);

    this.container.appendChild(wrapper);
  }

  renderShop(): void {
    const wrapper = this.el('div', 'shop-wrapper');
    wrapper.innerHTML = `
      <h2 class="shop-title">☕ Kaffeeküche</h2>
      <p class="shop-subtitle">Dein Gold: 💰 ${this.gameState.player.gold}</p>
    `;

    const purchased = this.gameState.shopPurchased ?? [];

    // Shop items
    if (this.gameState.shopItems && this.gameState.shopItems.length > 0) {
      const itemsEl = this.el('div', 'shop-section');
      itemsEl.innerHTML = '<div class="section-title">Items:</div>';
      this.gameState.shopItems.forEach((item, idx) => {
        const price = getItemShopPrice(item, this.gameState.currentFloor);
        const isBought = purchased.includes(`item_${idx}`);
        const card = this.renderItemCard(item);
        const btn = this.el('button', isBought ? 'bought-btn' : 'buy-btn');
        btn.textContent = isBought ? 'Gekauft' : `Kaufen (${price} 💰)`;
        btn.disabled = isBought || this.gameState.player.gold < price;
        btn.addEventListener('click', () => {
          this.onAction('buy-item', { itemIndex: idx, price });
        });
        card.appendChild(btn);
        itemsEl.appendChild(card);
      });
      wrapper.appendChild(itemsEl);
    }

    // Shop gems
    if (this.gameState.shopGems && this.gameState.shopGems.length > 0) {
      const gemsEl = this.el('div', 'shop-section');
      gemsEl.innerHTML = '<div class="section-title">Gems:</div>';
      this.gameState.shopGems.forEach((gem, idx) => {
        const price = getGemShopPrice(gem, this.gameState.currentFloor);
        const isBought = purchased.includes(`gem_${idx}`);
        const card = this.renderGemCard(gem);
        const btn = this.el('button', isBought ? 'bought-btn' : 'buy-btn');
        btn.textContent = isBought ? 'Gekauft' : `Kaufen (${price} 💰)`;
        btn.disabled = isBought || this.gameState.player.gold < price;
        btn.addEventListener('click', () => {
          this.onAction('buy-gem', { gemIndex: idx, price });
        });
        card.appendChild(btn);
        gemsEl.appendChild(card);
      });
      wrapper.appendChild(gemsEl);
    }

    const leaveBtn = this.el('button', 'continue-btn big-btn');
    leaveBtn.textContent = 'Kaffeeküche verlassen →';
    leaveBtn.addEventListener('click', () => this.onAction('leave-shop'));
    wrapper.appendChild(leaveBtn);

    this.container.appendChild(wrapper);
  }

  renderRest(): void {
    const wrapper = this.el('div', 'rest-wrapper');
    const healAmount = Math.floor(this.gameState.player.maxHp * 0.3);
    const newHp = Math.min(
      this.gameState.player.maxHp,
      this.gameState.player.hp + healAmount
    );

    wrapper.innerHTML = `
      <h2 class="rest-title">🍽️ Kantine</h2>
      <p class="rest-text">Du gönnst dir eine Mittagspause. Das Essen ist okay. Besser als nichts.</p>
      <div class="rest-heal">
        ❤️ HP: ${this.gameState.player.hp} → ${newHp} (+${Math.min(healAmount, this.gameState.player.maxHp - this.gameState.player.hp)})
      </div>
    `;

    const healBtn = this.el('button', 'continue-btn big-btn');
    healBtn.textContent = '🍜 Essen und ausruhen →';
    healBtn.addEventListener('click', () => this.onAction('rest-heal', { healAmount }));
    wrapper.appendChild(healBtn);

    // Gem management
    this.appendGemManagement(wrapper);

    this.container.appendChild(wrapper);
  }

  renderPrinter(): void {
    const wrapper = this.el('div', 'printer-wrapper');
    wrapper.innerHTML = `
      <h2 class="printer-title">🖨️ Druckerraum</h2>
      <p class="printer-text">Der Drucker blinkt. Das könnte gut oder schlecht ausgehen...</p>
    `;

    const useBtn = this.el('button', 'continue-btn big-btn');
    useBtn.textContent = '🎲 Drucker benutzen (50/50)';
    useBtn.addEventListener('click', () => this.onAction('use-printer'));
    wrapper.appendChild(useBtn);

    const skipBtn = this.el('button', 'skip-btn');
    skipBtn.textContent = 'Ignorieren →';
    skipBtn.addEventListener('click', () => this.onAction('skip-printer'));
    wrapper.appendChild(skipBtn);

    this.container.appendChild(wrapper);
  }

  renderGameOver(): void {
    const wrapper = this.el('div', 'gameover-wrapper');
    wrapper.innerHTML = `
      <div class="gameover-content">
        <h1 class="gameover-title">💼 Du wurdest entlassen</h1>
        <p class="gameover-text">
          Etage ${this.gameState.currentFloor} war zu viel. Du räumst deinen Schreibtisch.<br>
          Die Pflanzen nimmst du mit.
        </p>
        <div class="gameover-stats">
          <div>Etage erreicht: ${this.gameState.currentFloor}</div>
          <div>Monster besiegt: ${this.gameState.defeatedMonsters.length}</div>
          <div>Gold verdient: ${this.gameState.player.gold}</div>
        </div>
      </div>
    `;

    const retryBtn = this.el('button', 'continue-btn big-btn');
    retryBtn.textContent = '🔄 Neues Spiel';
    retryBtn.addEventListener('click', () => this.onAction('new-game'));
    wrapper.appendChild(retryBtn);

    this.container.appendChild(wrapper);
  }

  renderVictory(): void {
    const wrapper = this.el('div', 'victory-wrapper');
    wrapper.innerHTML = `
      <div class="victory-content">
        <h1 class="victory-title">🏆 Gehaltserhöhung!</h1>
        <p class="victory-text">
          Du hast den CEO besiegt. Die Gehaltserhöhung ist offiziell.<br>
          5%. Vor Steuern. Bei 40 Überstunden im Monat.
        </p>
        <p class="victory-subtext">
          Herzlichen Glückwunsch zum Aufstieg. Die nächste Etage wartet bereits.
        </p>
        <div class="victory-stats">
          <div>🏢 Alle 10 Etagen gemeistert!</div>
          <div>⚔️ Monster besiegt: ${this.gameState.defeatedMonsters.length}</div>
          <div>💰 Gold verdient: ${this.gameState.player.gold}</div>
        </div>
      </div>
    `;

    const newGameBtn = this.el('button', 'continue-btn big-btn');
    newGameBtn.textContent = '🔄 Neues Spiel';
    newGameBtn.addEventListener('click', () => this.onAction('new-game'));
    wrapper.appendChild(newGameBtn);

    this.container.appendChild(wrapper);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private renderCompactInventory(): HTMLElement {
    const panel = this.el('div', 'inventory-panel');
    panel.innerHTML = '<div class="section-title">Ausrüstung</div>';

    const slots: Array<{ key: string; label: string }> = [
      { key: 'helm', label: '🪖' },
      { key: 'weapon', label: '⚔️' },
      { key: 'offhand', label: '☕' },
      { key: 'armor', label: '🧥' },
      { key: 'gloves', label: '🧤' },
      { key: 'shoes', label: '👟' },
      { key: 'amulet', label: '📿' },
      { key: 'ring1', label: '💍' },
      { key: 'ring2', label: '💍' },
    ];

    const grid = this.el('div', 'equip-grid');
    for (const s of slots) {
      const item = this.gameState.equipment[s.key as keyof typeof this.gameState.equipment];
      const cell = this.el('div', 'equip-cell');
      cell.title = item ? `${item.name}\n${item.description}` : s.key;
      cell.innerHTML = `<span class="equip-icon">${s.label}</span>`;
      if (item) {
        cell.classList.add('equipped');
        cell.innerHTML += `<span class="equip-name">${item.name}</span>`;
      } else {
        cell.classList.add('empty-slot');
        cell.innerHTML += `<span class="equip-name empty">—</span>`;
      }
      grid.appendChild(cell);
    }
    panel.appendChild(grid);

    // Gem inventory summary
    if (this.gameState.gemInventory.length > 0) {
      const gemsSum = this.el('div', 'gems-summary');
      gemsSum.innerHTML = `<div class="section-title">Gem-Inventar (${this.gameState.gemInventory.length})</div>`;

      const gemManageBtn = this.el('button', 'manage-gems-btn');
      gemManageBtn.textContent = '⚙️ Gems verwalten';
      gemManageBtn.addEventListener('click', () => this.onAction('open-gem-manager'));
      gemsSum.appendChild(gemManageBtn);

      panel.appendChild(gemsSum);
    }

    return panel;
  }

  private renderSkillSlots(): HTMLElement {
    const panel = this.el('div', 'skill-slots-panel');
    panel.innerHTML = '<div class="section-title">Skill-Slots</div>';

    this.gameState.skillSlots.forEach((slot, idx) => {
      const slotEl = this.el('div', 'skill-slot-display');
      slotEl.innerHTML = `<span class="slot-num">Slot ${idx + 1}</span>`;

      if (slot.active) {
        slotEl.innerHTML += `
          <span class="slot-active">${slot.active.name} (Lv${slot.active.level})</span>
        `;
      } else {
        slotEl.innerHTML += `<span class="slot-empty">[ Leer ]</span>`;
      }

      if (slot.supports.length > 0) {
        slotEl.innerHTML += slot.supports
          .map((s) => `<span class="slot-support">${s.name}</span>`)
          .join('');
      }

      if (slot.trigger) {
        slotEl.innerHTML += `<span class="slot-trigger">⚡${slot.trigger.name}</span>`;
      }

      panel.appendChild(slotEl);
    });

    return panel;
  }

  private appendGemManagement(wrapper: HTMLElement): void {
    if (this.gameState.gemInventory.length === 0) return;

    const gemMgr = this.el('div', 'gem-manager');
    gemMgr.innerHTML = '<div class="section-title">⚙️ Gems verwalten</div>';

    // Show gem inventory
    this.gameState.gemInventory.forEach((gem, idx) => {
      const row = this.el('div', 'gem-manage-row');
      row.innerHTML = `
        <span class="gem-badge gem-${gem.role}">${gem.role.toUpperCase()}</span>
        <span class="gem-manage-name">${gem.name} Lv${gem.level}</span>
        <span class="gem-manage-val">${gem.effectValue}</span>
      `;

      // Add to slot buttons
      if (gem.role === 'active') {
        this.gameState.skillSlots.forEach((_slot, si) => {
          const btn = this.el('button', 'slot-assign-btn');
          btn.textContent = `→ Slot ${si + 1}`;
          btn.addEventListener('click', () => {
            this.onAction('assign-gem', { gemIndex: idx, slotIndex: si, role: 'active' });
          });
          row.appendChild(btn);
        });
      } else if (gem.role === 'support') {
        this.gameState.skillSlots.forEach((_slot, si) => {
          const btn = this.el('button', 'slot-assign-btn');
          btn.textContent = `→ Slot ${si + 1}`;
          btn.addEventListener('click', () => {
            this.onAction('assign-gem', { gemIndex: idx, slotIndex: si, role: 'support' });
          });
          row.appendChild(btn);
        });
      } else if (gem.role === 'trigger') {
        this.gameState.skillSlots.forEach((_slot, si) => {
          const btn = this.el('button', 'slot-assign-btn');
          btn.textContent = `→ Slot ${si + 1}`;
          btn.addEventListener('click', () => {
            this.onAction('assign-gem', { gemIndex: idx, slotIndex: si, role: 'trigger' });
          });
          row.appendChild(btn);
        });
      }

      gemMgr.appendChild(row);
    });

    // Fusion pairs
    const fusionPairs = findFusionPairs(this.gameState.gemInventory);
    if (fusionPairs.length > 0) {
      const fusionSection = this.el('div', 'fusion-section');
      fusionSection.innerHTML = '<div class="section-title">⚗️ Fusion:</div>';
      fusionPairs.forEach(([g1, g2], idx) => {
        const btn = this.el('button', 'fusion-btn');
        btn.innerHTML = `${g1.name} Lv${g1.level} + ${g2.name} Lv${g2.level} → Lv${g1.level + 1}`;
        btn.addEventListener('click', () => {
          this.onAction('fuse-gems', { pairIndex: idx });
        });
        fusionSection.appendChild(btn);
      });
      gemMgr.appendChild(fusionSection);
    }

    wrapper.appendChild(gemMgr);
  }

  renderGemManager(): void {
    const overlay = this.el('div', 'gem-manager-overlay');
    this.appendGemManagement(overlay);

    const closeBtn = this.el('button', 'close-btn');
    closeBtn.textContent = '✕ Schließen';
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });
    overlay.appendChild(closeBtn);
    this.container.appendChild(overlay);
  }

  private renderGemCard(gem: Gem): HTMLElement {
    const card = this.el('div', `gem-card gem-${gem.role}`);
    card.innerHTML = `
      <div class="gem-header">
        <span class="gem-name">${gem.name}</span>
        <span class="gem-level">Lv${gem.level}</span>
        <span class="gem-badge gem-${gem.role}">${gem.role}</span>
      </div>
      <div class="gem-desc">${gem.description}</div>
      ${gem.tags ? `<div class="gem-tags">Tags: ${gem.tags.join(', ')}</div>` : ''}
      <div class="gem-flavor">"${gem.flavorText}"</div>
    `;
    return card;
  }

  private renderItemCard(item: Item): HTMLElement {
    const card = this.el('div', 'item-card');
    const statsStr = Object.entries(item.stats)
      .filter(([, v]) => v !== undefined && v !== 0)
      .map(([k, v]) => `+${v} ${k}`)
      .join(', ');
    card.innerHTML = `
      <div class="item-header">
        <span class="item-name">${item.name}</span>
        <span class="item-slot">${item.slot}</span>
      </div>
      <div class="item-stats">${statsStr || 'Keine Stats'}</div>
      <div class="item-flavor">"${item.flavorText}"</div>
    `;
    return card;
  }

  private el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  }

  private escHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
