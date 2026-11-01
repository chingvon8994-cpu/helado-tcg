/**
 * Deterministic RNG (mulberry32). The RNG state is stored inside GameState so the server can
 * replay/validate matches, and it is stripped from player views so clients cannot predict flips.
 */
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

export class Rng {
  constructor(public seed: number) {}
  next(): number {
    const [v, s] = nextRandom(this.seed);
    this.seed = s;
    return v;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  coin(): boolean {
    return this.next() < 0.5;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
