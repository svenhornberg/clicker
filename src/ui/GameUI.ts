// GameUI.ts — DOM rendering, no game logic
import type {
  GameState,
  CombatState,
  LootResult,
  Room,
  Gem,
  Item,
  Department,
  MetaState,
  MetaUpgrade,
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

const MONSTER_ICONS: Record<string, string> = {
  monster_newbie_onboarding:        '😰',
  monster_itguy_onboarding:         '🖥️',
  monster_hrbot_onboarding:         '🤖',
  monster_juniorpm_marketing:       '📣',
  monster_influencer_marketing:     '🤳',
  monster_contentcreator_marketing: '✏️',
  monster_headofbrand_marketing:    '🎨',
  monster_pm_produkt:               '🗂️',
  monster_scrummaster_produkt:      '🔄',
  monster_designer_produkt:         '🖌️',
  monster_po_produkt:               '📌',
  monster_analyst_controlling:      '📉',
  monster_audit_controlling:        '🔍',
  monster_controller_controlling:   '🧮',
  monster_cfoassist_controlling:    '💰',
  monster_sysadmin_it:              '🐧',
  monster_ticketgeist_it:           '🎫',
  monster_devops_it:                '⚙️',
  monster_seniorsysadmin_it:        '💾',
  monster_secretary_chef:           '📞',
  monster_headpa_chef:              '🗝️',
  monster_ceo_chef:                 '👑',
};

function getMonsterIcon(id: string): string {
  return MONSTER_ICONS[id] ?? '👤';
}

const GEM_ROLE_ICONS: Record<string, string> = {
  active:  '🔷',
  support: '🔶',
  trigger: '⚡',
};

export class GameUI {
  private container: HTMLElement;
  private gameState: GameState;
  private onAction: (action: string, data?: unknown) => void;
  private currentFloors: ReturnType<typeof import('../data/floors').createFloors> | null = null;
  private autoClickActive = false;

  setAutoClick(active: boolean): void {
    this.autoClickActive = active;
    // Update the toggle button if it exists in DOM without full re-render
    const btn = document.querySelector<HTMLButtonElement>('.auto-click-btn');
    if (btn) {
      btn.textContent = active ? '🤖 Auto: AN' : '🖱️ Auto: AUS';
      btn.classList.toggle('auto-click-on', active);
    }
  }

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
      case 'meta':
        // renderMeta is called directly with metaState and upgrades
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

  // Called once when entering combat — builds persistent DOM structure
  renderCombat(combatState: CombatState): void {
    const enemy = combatState.enemy;
    const dept = enemy.department;
    const color = DEPT_COLORS[dept];

    const wrapper = this.el('div', 'combat-wrapper');
    wrapper.dataset.combatRoot = '1';

    // Enemy panel
    const enemyPanel = this.el('div', 'enemy-panel');
    enemyPanel.style.borderColor = color;
    enemyPanel.innerHTML = `
      <div class="enemy-header">
        <span class="enemy-icon">${getMonsterIcon(enemy.id)}</span>
        <span class="enemy-name" style="color:${color}">${enemy.name}</span>
        ${enemy.isBoss ? '<span class="boss-badge">BOSS</span>' : ''}
        <span class="enemy-dept">${DEPARTMENT_NAMES[dept]}</span>
      </div>
      <div class="hp-bar-container">
        <div class="hp-bar" id="enemy-hp-bar" style="width:100%;background:${color}"></div>
        <span class="hp-text" id="enemy-hp-text">${combatState.enemyHp}/${enemy.maxHp}</span>
      </div>
      <div class="enemy-attack-timer">
        <span class="attack-timer-label">Angriff in:</span>
        <div class="skill-slot-cooldown">
          <div class="skill-slot-cooldown-fill" id="enemy-cd-bar" style="width:0%;background:#ef4444aa"></div>
        </div>
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
    playerPanel.innerHTML = `
      <div class="player-header">
        <span>Du (Etage ${this.gameState.currentFloor})</span>
        <span class="gold-display">💰 ${this.gameState.player.gold}</span>
      </div>
      <div class="hp-bar-container">
        <div class="hp-bar player-hp-bar" id="player-hp-bar" style="width:100%"></div>
        <span class="hp-text" id="player-hp-text">${combatState.playerHp}/${this.gameState.player.maxHp}</span>
      </div>
    `;
    wrapper.appendChild(playerPanel);

    // Skill buttons (built once, persistent)
    const skillsEl = this.el('div', 'combat-skills');
    skillsEl.innerHTML = '<div class="skills-title">Skill-Slots:</div>';

    this.gameState.skillSlots.forEach((slot, idx) => {
      if (!slot.active) return;
      const gem = slot.active;
      const tags = gem.tags?.join(', ') ?? '';
      const gemIcon = gem.icon ?? GEM_ROLE_ICONS[gem.role] ?? '🔷';

      const btn = this.el('button', 'skill-btn');
      btn.dataset.slotIndex = String(idx);
      btn.innerHTML = `
        <div class="skill-btn-content">
          <span class="skill-gem-icon">${gemIcon}</span>
          <span class="skill-name">${gem.name}</span>
          <span class="skill-tags">${tags}</span>
          ${slot.supports.length > 0
            ? `<span class="skill-supports">${slot.supports.map((s) => `${s.icon ?? '🔶'} ${s.name}`).join(' + ')}</span>`
            : ''}
          ${slot.trigger ? `<span class="skill-trigger">${slot.trigger.icon ?? '⚡'} ${slot.trigger.name}</span>` : ''}
          <span class="skill-dmg">~${gem.effectValue * gem.level} dmg</span>
        </div>
        <div class="skill-slot-cooldown">
          <div class="skill-slot-cooldown-fill" id="slot-cd-${idx}" style="width:100%"></div>
        </div>
      `;
      btn.addEventListener('click', () => this.onAction('player-attack', { slotIndex: idx }));
      skillsEl.appendChild(btn);
    });

    const autoBtn = this.el('button', `auto-click-btn${this.autoClickActive ? ' auto-click-on' : ''}`);
    autoBtn.textContent = this.autoClickActive ? '🤖 Auto: AN' : '🖱️ Auto: AUS';
    autoBtn.title = 'Auto-Klicker: feuert alle 1s einen zufälligen Slot';
    autoBtn.addEventListener('click', () => this.onAction('toggle-auto-click'));
    skillsEl.appendChild(autoBtn);

    const escBtn = this.el('button', 'escape-btn');
    escBtn.textContent = '🏃 Fliehen';
    escBtn.addEventListener('click', () => this.onAction('escape'));
    skillsEl.appendChild(escBtn);

    wrapper.appendChild(skillsEl);

    // Combat log
    const logEl = this.el('div', 'combat-log');
    logEl.id = 'combat-log';
    wrapper.appendChild(logEl);

    // Round info
    const roundEl = this.el('div', 'round-info');
    roundEl.id = 'combat-round';
    roundEl.textContent = `Runde ${combatState.round}`;
    wrapper.appendChild(roundEl);

    this.container.innerHTML = '';
    this.container.appendChild(wrapper);

    // Initial data patch
    this.updateCombat(combatState);
  }

  // Called every 100ms — only patches dynamic values, never rebuilds DOM
  updateCombat(combatState: CombatState): void {
    const enemy = combatState.enemy;

    // HP bars
    const enemyHpPct = Math.max(0, (combatState.enemyHp / enemy.maxHp) * 100);
    const playerHpPct = Math.max(0, (combatState.playerHp / this.gameState.player.maxHp) * 100);
    const enemyHpBar = document.getElementById('enemy-hp-bar') as HTMLElement | null;
    const enemyHpText = document.getElementById('enemy-hp-text') as HTMLElement | null;
    const playerHpBar = document.getElementById('player-hp-bar') as HTMLElement | null;
    const playerHpText = document.getElementById('player-hp-text') as HTMLElement | null;
    if (enemyHpBar) enemyHpBar.style.width = `${enemyHpPct}%`;
    if (enemyHpText) enemyHpText.textContent = `${combatState.enemyHp}/${enemy.maxHp}`;
    if (playerHpBar) playerHpBar.style.width = `${playerHpPct}%`;
    if (playerHpText) playerHpText.textContent = `${combatState.playerHp}/${this.gameState.player.maxHp}`;

    // Enemy attack timer
    const enemyCdPct = combatState.enemyMaxCooldown > 0
      ? Math.max(0, Math.min(100, (1 - combatState.enemyCooldown / combatState.enemyMaxCooldown) * 100))
      : 0;
    const enemyCdBar = document.getElementById('enemy-cd-bar') as HTMLElement | null;
    if (enemyCdBar) enemyCdBar.style.width = `${enemyCdPct}%`;

    // Slot cooldown bars
    combatState.slotCooldowns.forEach((cd, idx) => {
      const cdMax = combatState.slotMaxCooldowns[idx] ?? 4000;
      const fillPct = cdMax > 0 ? Math.max(0, Math.min(100, (1 - cd / cdMax) * 100)) : 100;
      const bar = document.getElementById(`slot-cd-${idx}`) as HTMLElement | null;
      if (bar) {
        bar.style.width = `${fillPct}%`;
        bar.classList.toggle('ready', fillPct >= 99);
      }
    });

    // Log — only append new lines
    const logEl = document.getElementById('combat-log') as HTMLElement | null;
    if (logEl) {
      const rendered = logEl.querySelectorAll('.log-line').length;
      const newLines = combatState.log.slice(rendered);
      newLines.forEach(line => {
        const div = document.createElement('div');
        div.className = 'log-line';
        div.textContent = line;
        logEl.appendChild(div);
      });
      if (newLines.length > 0) logEl.scrollTop = logEl.scrollHeight;
      // Keep max 30 lines in DOM
      while (logEl.children.length > 30) logEl.removeChild(logEl.firstChild!);
    }

    // Round
    const roundEl = document.getElementById('combat-round') as HTMLElement | null;
    if (roundEl) roundEl.textContent = `Runde ${combatState.round}`;

    // Combat over — replace skills area with result
    if (combatState.isOver) {
      const skillsEl = this.container.querySelector('.combat-skills') as HTMLElement | null;
      if (skillsEl) {
        skillsEl.innerHTML = '';
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
        skillsEl.appendChild(resultEl);
      }
    }
  }


  renderMeta(metaState: MetaState, availableUpgrades: MetaUpgrade[]): void {
    this.container.innerHTML = '';

    const wrapper = this.el('div', 'meta-screen');

    const header = this.el('div', 'meta-header');
    header.innerHTML = `
      <h1 class="meta-title">🏢 Karriereberatung</h1>
      <p class="meta-subtitle">Investiere deine Betriebsjahre in permanente Verbesserungen.</p>
    `;
    wrapper.appendChild(header);

    const currencyEl = this.el('div', 'meta-currency');
    currencyEl.textContent = `⏳ ${metaState.betriebsjahre} Betriebsjahre`;
    wrapper.appendChild(currencyEl);

    const statsEl = this.el('div', 'meta-stats');
    statsEl.innerHTML = `
      <span>Runs: ${metaState.totalRuns}</span>
      <span>Höchste Etage: ${metaState.highestFloorReached}</span>
      <span>Siege: ${metaState.victories}</span>
    `;
    wrapper.appendChild(statsEl);

    const grid = this.el('div', 'meta-upgrades-grid');

    for (const upgrade of availableUpgrades) {
      const currentLevel = metaState.upgrades[upgrade.id] ?? 0;
      const isMaxed = currentLevel >= upgrade.maxLevel;
      const nextCost = isMaxed ? null : upgrade.costPerLevel[currentLevel];
      const canAffordIt = nextCost !== null && metaState.betriebsjahre >= nextCost;

      const card = this.el('div', `meta-upgrade-card${isMaxed ? ' maxed' : ''}`);

      // Level dots
      const dotsEl = this.el('div', 'meta-upgrade-level-dots');
      for (let i = 0; i < upgrade.maxLevel; i++) {
        const dot = this.el('div', `meta-upgrade-level-dot${i < currentLevel ? ' filled' : ''}`);
        dotsEl.appendChild(dot);
      }

      const nameEl = this.el('div', 'meta-upgrade-name');
      nameEl.textContent = upgrade.name;
      card.appendChild(nameEl);
      card.appendChild(dotsEl);

      const descEl = this.el('div', 'meta-upgrade-desc');
      descEl.textContent = upgrade.description;
      card.appendChild(descEl);

      const flavorEl = this.el('div', 'meta-upgrade-flavor');
      flavorEl.textContent = `"${upgrade.flavorText}"`;
      card.appendChild(flavorEl);

      if (isMaxed) {
        const maxedBadge = this.el('div', 'meta-upgrade-maxed-badge');
        maxedBadge.textContent = 'MAX';
        card.appendChild(maxedBadge);
      } else {
        const costEl = this.el('div', 'meta-upgrade-cost');
        costEl.textContent = `${nextCost} Betriebsjahre`;
        card.appendChild(costEl);

        const btn = this.el('button', `meta-upgrade-btn${canAffordIt ? '' : ' disabled'}`);
        btn.textContent = canAffordIt ? 'Upgraden' : 'Zu teuer';
        btn.disabled = !canAffordIt;
        if (canAffordIt) {
          const upgradeId = upgrade.id;
          btn.addEventListener('click', () => {
            this.onAction('purchase-upgrade', { upgradeId });
          });
        }
        card.appendChild(btn);
      }

      grid.appendChild(card);
    }

    wrapper.appendChild(grid);

    const newRunBtn = this.el('button', 'continue-btn big-btn meta-new-run-btn');
    newRunBtn.textContent = '▶ Neuer Versuch';
    newRunBtn.addEventListener('click', () => this.onAction('new-game'));
    wrapper.appendChild(newRunBtn);

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

    const metaBtn = this.el('button', 'continue-btn big-btn');
    metaBtn.textContent = '🏢 Karriereberatung';
    metaBtn.addEventListener('click', () => this.onAction('go-to-meta'));
    wrapper.appendChild(metaBtn);

    const retryBtn = this.el('button', 'skip-btn');
    retryBtn.textContent = '🔄 Direkt neues Spiel';
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

    const metaBtn = this.el('button', 'continue-btn big-btn');
    metaBtn.textContent = '🏢 Karriereberatung';
    metaBtn.addEventListener('click', () => this.onAction('go-to-meta'));
    wrapper.appendChild(metaBtn);

    const newGameBtn = this.el('button', 'skip-btn');
    newGameBtn.textContent = '🔄 Direkt neues Spiel';
    newGameBtn.addEventListener('click', () => this.onAction('new-game'));
    wrapper.appendChild(newGameBtn);

    this.container.appendChild(wrapper);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private renderCompactInventory(): HTMLElement {
    const panel = this.el('div', 'inventory-panel');
    panel.innerHTML = '<div class="section-title">Mitarbeiterausstattung</div>';

    // ── Slot definitions ─────────────────────────────────────────────────────
    const slots: Array<{ key: string; icon: string; label: string }> = [
      { key: 'helm',    icon: '🎧', label: 'Kopf' },
      { key: 'weapon',  icon: '⌨️', label: 'Waffe' },
      { key: 'offhand', icon: '☕', label: 'Offhand' },
      { key: 'armor',   icon: '👔', label: 'Rüstung' },
      { key: 'gloves',  icon: '🖱️', label: 'Handschuhe' },
      { key: 'shoes',   icon: '👟', label: 'Schuhe' },
      { key: 'amulet',  icon: '📎', label: 'Amulett' },
      { key: 'ring1',   icon: '🪪', label: 'Ring 1' },
      { key: 'ring2',   icon: '🪪', label: 'Ring 2' },
    ];

    // ── Two-column layout: doll + backpack ──────────────────────────────────
    const charScreen = this.el('div', 'char-screen');

    // ── Left: paper doll ────────────────────────────────────────────────────
    const doll = this.el('div', 'char-doll');

    // Silhouette figure
    const silhouette = this.el('div', 'char-silhouette');
    silhouette.textContent = '🧑‍💼';
    doll.appendChild(silhouette);

    // Subtle employee-ID watermark label
    const idLabel = this.el('div', 'char-id-label');
    idLabel.textContent = 'Mitarbeiter-Ausweis';
    doll.appendChild(idLabel);

    // Place each equip slot absolutely around the silhouette
    for (const s of slots) {
      const item = this.gameState.equipment[s.key as keyof typeof this.gameState.equipment];
      const slot = this.el('div', 'equip-slot');
      slot.dataset.slot = s.key;

      if (item) {
        slot.classList.add('filled');
        slot.title = `${item.name}\n${item.description}\n\n${item.flavorText}`;
        slot.innerHTML = `
          <span class="equip-slot-icon">${s.icon}</span>
          <span class="equip-slot-label">${s.label}</span>
          <span class="equip-slot-name">${item.name}</span>
        `;
      } else {
        slot.classList.add('empty');
        slot.title = `${s.label} — leer`;
        slot.innerHTML = `
          <span class="equip-slot-icon" style="opacity:0.35">${s.icon}</span>
          <span class="equip-slot-label">${s.label}</span>
        `;
      }

      doll.appendChild(slot);
    }

    charScreen.appendChild(doll);

    // ── Right: backpack (unequipped items from inventory) ────────────────────
    const backpack = this.el('div', 'char-backpack');

    const slotLabels: Record<string, string> = {
      helm: 'Kopf', weapon: 'Waffe', offhand: 'Offhand',
      armor: 'Rüstung', gloves: 'Handschuhe', shoes: 'Schuhe',
      amulet: 'Amulett', ring1: 'Ring 1', ring2: 'Ring 2',
    };
    const slotIcons: Record<string, string> = {
      helm: '🎧', weapon: '⌨️', offhand: '☕',
      armor: '👔', gloves: '🖱️', shoes: '👟',
      amulet: '📎', ring1: '🪪', ring2: '🪪',
    };

    const bpTitle = this.el('div', 'char-backpack-title');
    bpTitle.textContent = `📦 Rucksack (${this.gameState.inventory.length})`;
    backpack.appendChild(bpTitle);

    if (this.gameState.inventory.length === 0) {
      const empty = this.el('div', 'backpack-empty');
      empty.textContent = 'Rucksack leer — mehr Überstunden nötig.';
      backpack.appendChild(empty);
    } else {
      for (const item of this.gameState.inventory) {
        const row = this.el('div', 'backpack-item');
        row.title = `${item.description}\n\n${item.flavorText}`;

        const header = this.el('div', 'backpack-item-header');
        header.innerHTML = `
          <span>${slotIcons[item.slot] ?? '📦'}</span>
          <span>${item.name}</span>
          <span class="backpack-item-slot">${slotLabels[item.slot] ?? item.slot}</span>
        `;

        const desc = this.el('div', 'backpack-item-desc');
        desc.textContent = item.description;

        row.appendChild(header);
        row.appendChild(desc);
        backpack.appendChild(row);
      }
    }

    charScreen.appendChild(backpack);
    panel.appendChild(charScreen);

    // ── Gem inventory summary ────────────────────────────────────────────────
    const totalGems = this.gameState.gemInventory.length +
      this.gameState.skillSlots.reduce((n, s) =>
        n + (s.active ? 1 : 0) + s.supports.length + (s.trigger ? 1 : 0), 0);

    if (totalGems > 0) {
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

  // ─── Drag & Drop Gem Manager ────────────────────────────────────────────────

  private makeDraggableGem(gem: Gem, dragData: object): HTMLElement {
    const card = this.el('div', `dnd-gem gem-role-${gem.role}`);
    card.draggable = true;
    card.innerHTML = `
      <span class="dnd-gem-icon">${gem.icon ?? GEM_ROLE_ICONS[gem.role] ?? '🔷'}</span>
      <span class="dnd-gem-name">${gem.name}</span>
      <span class="dnd-gem-meta">Lv${gem.level} · ${gem.effectValue}</span>
    `;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('application/json', JSON.stringify(dragData));
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    return card;
  }

  private makeDropZone(
    label: string,
    acceptRole: string,
    onDrop: (data: Record<string, unknown>) => void,
    filledGem?: Gem | null,
    filledDragData?: object
  ): HTMLElement {
    const zone = this.el('div', `dnd-drop-zone dnd-zone-${acceptRole}${filledGem ? ' filled' : ' empty'}`);

    if (filledGem) {
      const inner = this.makeDraggableGem(filledGem, filledDragData!);
      zone.appendChild(inner);
    } else {
      zone.innerHTML = `<span class="dnd-placeholder">${label}</span>`;
    }

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      try {
        const raw = e.dataTransfer!.getData('application/json');
        if (!raw) { zone.classList.add('drag-over'); return; }
        const data = JSON.parse(raw) as Record<string, unknown>;
        const gemRole = data.gemRole as string;
        if (gemRole === acceptRole) zone.classList.add('drag-over');
        else zone.classList.add('drag-reject');
      } catch { zone.classList.add('drag-over'); }
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over', 'drag-reject');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over', 'drag-reject');
      try {
        const raw = e.dataTransfer!.getData('application/json');
        if (!raw) return;
        const data = JSON.parse(raw) as Record<string, unknown>;
        if ((data.gemRole as string) === acceptRole) onDrop(data);
      } catch { /* ignore */ }
    });

    return zone;
  }

  private appendGemManagement(wrapper: HTMLElement): void {
    const gemMgr = this.el('div', 'gem-manager-dnd');
    gemMgr.innerHTML = '<div class="section-title">⚙️ Gems verwalten — Ziehen & Ablegen</div>';

    // ── Skill Slot Zones ────────────────────────────────────────────────────
    const slotsSection = this.el('div', 'dnd-slots-section');

    this.gameState.skillSlots.forEach((slot, si) => {
      const slotRow = this.el('div', 'dnd-slot-row');
      slotRow.innerHTML = `<div class="dnd-slot-label">Slot ${si + 1}</div>`;

      // Active zone
      const activeZone = this.makeDropZone(
        '[ ACTIVE ]', 'active',
        (data) => {
          if (data.source === 'inventory') {
            this.onAction('assign-gem', { gemIndex: data.gemIndex, slotIndex: si, role: 'active' });
          } else {
            this.onAction('move-gem', { fromSlot: data.slotIndex, fromRole: data.role, fromSupportIndex: data.supportIndex, toSlot: si, toRole: 'active' });
          }
        },
        slot.active,
        slot.active ? { source: 'slot', slotIndex: si, role: 'active', gemRole: 'active' } : undefined
      );
      if (slot.active) {
        activeZone.querySelector('.dnd-gem')?.addEventListener('dblclick', () => {
          this.onAction('remove-gem', { slotIndex: si, role: 'active' });
        });
      }
      slotRow.appendChild(activeZone);

      // Support zones (3)
      const supportsWrap = this.el('div', 'dnd-supports-wrap');
      for (let si2 = 0; si2 < 3; si2++) {
        const existingSupport = slot.supports[si2] ?? null;
        const supportZone = this.makeDropZone(
          '[ + ]', 'support',
          (data) => {
            if (data.source === 'inventory') {
              this.onAction('assign-gem', { gemIndex: data.gemIndex, slotIndex: si, role: 'support' });
            } else {
              this.onAction('move-gem', { fromSlot: data.slotIndex, fromRole: data.role, fromSupportIndex: data.supportIndex, toSlot: si, toRole: 'support' });
            }
          },
          existingSupport,
          existingSupport ? { source: 'slot', slotIndex: si, role: 'support', supportIndex: si2, gemRole: 'support' } : undefined
        );
        if (existingSupport) {
          const capturedIdx = si2;
          supportZone.querySelector('.dnd-gem')?.addEventListener('dblclick', () => {
            this.onAction('remove-gem', { slotIndex: si, role: 'support', supportIndex: capturedIdx });
          });
        }
        supportsWrap.appendChild(supportZone);
      }
      slotRow.appendChild(supportsWrap);

      // Trigger zone
      const triggerZone = this.makeDropZone(
        '[ ⚡ ]', 'trigger',
        (data) => {
          if (data.source === 'inventory') {
            this.onAction('assign-gem', { gemIndex: data.gemIndex, slotIndex: si, role: 'trigger' });
          } else {
            this.onAction('move-gem', { fromSlot: data.slotIndex, fromRole: data.role, fromSupportIndex: data.supportIndex, toSlot: si, toRole: 'trigger' });
          }
        },
        slot.trigger,
        slot.trigger ? { source: 'slot', slotIndex: si, role: 'trigger', gemRole: 'trigger' } : undefined
      );
      if (slot.trigger) {
        triggerZone.querySelector('.dnd-gem')?.addEventListener('dblclick', () => {
          this.onAction('remove-gem', { slotIndex: si, role: 'trigger' });
        });
      }
      slotRow.appendChild(triggerZone);

      slotsSection.appendChild(slotRow);
    });
    gemMgr.appendChild(slotsSection);

    // ── Gem Inventory ────────────────────────────────────────────────────────
    if (this.gameState.gemInventory.length > 0) {
      const invSection = this.el('div', 'dnd-inventory-section');
      invSection.innerHTML = `<div class="section-title">📦 Inventar (${this.gameState.gemInventory.length} Gems)</div>`;
      const invGrid = this.el('div', 'dnd-inventory-grid');

      this.gameState.gemInventory.forEach((gem, idx) => {
        const card = this.makeDraggableGem(gem, {
          source: 'inventory',
          gemIndex: idx,
          gemRole: gem.role,
        });
        invGrid.appendChild(card);
      });

      invSection.appendChild(invGrid);
      gemMgr.appendChild(invSection);
    } else {
      const empty = this.el('div', 'dnd-inventory-empty');
      empty.textContent = '📦 Kein Gem im Inventar.';
      gemMgr.appendChild(empty);
    }

    // ── Fusion ───────────────────────────────────────────────────────────────
    const fusionPairs = findFusionPairs(this.gameState.gemInventory);
    if (fusionPairs.length > 0) {
      const fusionSection = this.el('div', 'fusion-section');
      fusionSection.innerHTML = '<div class="section-title">⚗️ Fusion verfügbar:</div>';
      fusionPairs.forEach(([g1, g2], idx) => {
        const btn = this.el('button', 'fusion-btn');
        btn.innerHTML = `${g1.icon ?? ''} ${g1.name} Lv${g1.level} + ${g2.icon ?? ''} ${g2.name} Lv${g2.level} → <strong>Lv${(g1.level + 1)}</strong>`;
        btn.addEventListener('click', () => this.onAction('fuse-gems', { pairIndex: idx }));
        fusionSection.appendChild(btn);
      });
      gemMgr.appendChild(fusionSection);
    }

    // Hint
    const hint = this.el('div', 'dnd-hint');
    hint.textContent = 'Tipp: Doppelklick auf einen Gem im Slot entfernt ihn.';
    gemMgr.appendChild(hint);

    wrapper.appendChild(gemMgr);
  }

  renderGemManager(): void {
    // Remove existing overlay if open
    document.querySelector('.gem-manager-overlay')?.remove();

    const overlay = this.el('div', 'gem-manager-overlay');
    this.appendGemManagement(overlay);

    const closeBtn = this.el('button', 'close-btn');
    closeBtn.textContent = '✕ Schließen';
    closeBtn.addEventListener('click', () => overlay.remove());
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

}
