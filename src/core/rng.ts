export interface SeededRng {
  next(): number;
  nextInt(maxExclusive: number): number;
  bool(probability: number): boolean;
  choose<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  pickWeighted<T>(items: readonly T[], weight: (item: T) => number): T;
}

function mix(seed: number): number {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function hashSeed(...parts: Array<number | string>): number {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
      hash >>>= 0;
    }
  }
  return hash >>> 0;
}

export function createRng(seed: number): SeededRng {
  let state = mix(seed || 1);

  const next = (): number => {
    state = mix(state || 1);
    return (state >>> 0) / 4294967296;
  };

  const nextInt = (maxExclusive: number): number => {
    if (maxExclusive <= 0) {
      return 0;
    }
    return Math.floor(next() * maxExclusive);
  };

  const bool = (probability: number): boolean => next() < probability;

  const choose = <T>(items: readonly T[]): T => {
    if (items.length === 0) {
      throw new Error("Cannot choose from empty array");
    }
    return items[nextInt(items.length)]!;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = nextInt(i + 1);
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  const pickWeighted = <T>(items: readonly T[], weight: (item: T) => number): T => {
    if (items.length === 0) {
      throw new Error("Cannot pick from empty weighted array");
    }

    let total = 0;
    for (const item of items) {
      total += Math.max(0, weight(item));
    }

    if (total <= 0) {
      return choose(items);
    }

    let needle = next() * total;
    for (const item of items) {
      needle -= Math.max(0, weight(item));
      if (needle <= 0) {
        return item;
      }
    }

    return items[items.length - 1]!;
  };

  return {
    next,
    nextInt,
    bool,
    choose,
    shuffle,
    pickWeighted
  };
}
