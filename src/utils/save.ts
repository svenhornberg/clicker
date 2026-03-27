// save.ts — all save/load logic goes through here
// Never call localStorage directly elsewhere

import type { GameState, MetaState } from '../core/types';

const SAVE_KEY = 'gemrogue_save';
const META_KEY = 'gemrogue_meta';

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

export function saveMeta(state: MetaState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(META_KEY, serialized);
  } catch (e) {
    console.error('Failed to save meta state:', e);
  }
}

export function loadMeta(): MetaState | null {
  try {
    const data = localStorage.getItem(META_KEY);
    if (!data) return null;
    return JSON.parse(data) as MetaState;
  } catch (e) {
    console.error('Failed to load meta state:', e);
    return null;
  }
}
