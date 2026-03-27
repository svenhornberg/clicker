// save.ts — all save/load logic goes through here
// Never call localStorage directly elsewhere

import type { GameState } from '../core/types';

const SAVE_KEY = 'gemrogue_save';

export function saveGame(state: GameState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, serialized);
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export function loadGame(): GameState | null {
  try {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    return JSON.parse(data) as GameState;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
