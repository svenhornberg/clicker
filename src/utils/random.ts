// random.ts — all randomness routes through here

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomElement<T>(arr: T[]): T {
  if (arr.length === 0) {
    throw new Error('Cannot pick from empty array');
  }
  return arr[randomInt(0, arr.length - 1)];
}

export function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = shuffle([...arr]);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
