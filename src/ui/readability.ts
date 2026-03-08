import { GameState } from "../core/types";

interface NumberFormatOptions {
  signed?: boolean;
  currency?: boolean;
}

interface TextFormatOptions {
  seedKey?: string;
  critical?: boolean;
}

export interface ReadingObfuscationMeta {
  clarity: number;
  clarityPercent: number;
  bandLabel: "0-24%" | "25-49%" | "50-74%" | "75-94%" | "95-100%";
  scrambleChance: number;
  fullyClear: boolean;
}

export function getReadingClarity(state: GameState): number {
  return clamp(0.4 + state.officeSkills.readingXp / 400, 0.4, 1);
}

export function getAccountingClarity(state: GameState): number {
  const accountantBonus = state.operations.accountantHired ? 0.25 : 0;
  return clamp(0.4 + state.officeSkills.accountingXp / 400 + accountantBonus, 0.4, 1);
}

export function getReadingObfuscationMeta(state: GameState): ReadingObfuscationMeta {
  const clarity = getReadingClarity(state);
  if (clarity >= 0.95) {
    return {
      clarity,
      clarityPercent: Math.round(clarity * 100),
      bandLabel: "95-100%",
      scrambleChance: 0,
      fullyClear: true
    };
  }
  if (clarity >= 0.75) {
    return {
      clarity,
      clarityPercent: Math.round(clarity * 100),
      bandLabel: "75-94%",
      scrambleChance: 0.1,
      fullyClear: false
    };
  }
  if (clarity >= 0.5) {
    return {
      clarity,
      clarityPercent: Math.round(clarity * 100),
      bandLabel: "50-74%",
      scrambleChance: 0.2,
      fullyClear: false
    };
  }
  if (clarity >= 0.25) {
    return {
      clarity,
      clarityPercent: Math.round(clarity * 100),
      bandLabel: "25-49%",
      scrambleChance: 0.32,
      fullyClear: false
    };
  }
  return {
    clarity,
    clarityPercent: Math.round(clarity * 100),
    bandLabel: "0-24%",
    scrambleChance: 0.45,
    fullyClear: false
  };
}

export function obfuscateReadableText(state: GameState, text: string, seedKey = ""): string {
  const readingMeta = getReadingObfuscationMeta(state);
  if (readingMeta.fullyClear) {
    return text;
  }
  return text
    .split(" ")
    .map((word, index) => maybeScrambleWord(word, `${seedKey}:${index}`, readingMeta.scrambleChance))
    .join(" ");
}

export function formatReadableText(state: GameState, text: string, options: TextFormatOptions = {}): string {
  if (options.critical) {
    return text;
  }
  return obfuscateReadableText(state, text, options.seedKey ?? "");
}

export function formatNumberByAccountingClarity(state: GameState, value: number, options: NumberFormatOptions = {}): string {
  const clarity = getAccountingClarity(state);
  const currencyPrefix = options.currency ? "$" : "";
  const signedPrefix = options.signed && value > 0 ? "+" : "";
  if (clarity >= 0.9) {
    return `${currencyPrefix}${signedPrefix}${value}`;
  }
  if (clarity >= 0.7) {
    const rounded10 = Math.round(value / 10) * 10;
    return `${currencyPrefix}~${signedPrefix}${rounded10}`;
  }
  if (Math.abs(value) <= 20) {
    const rounded5 = Math.round(value / 5) * 5;
    return `${currencyPrefix}~${signedPrefix}${rounded5}`;
  }
  return `${currencyPrefix}??`;
}

export function formatCashByAccountingClarity(state: GameState, value: number, signed = false): string {
  return formatNumberByAccountingClarity(state, value, { currency: true, signed });
}

function maybeScrambleWord(word: string, key: string, chance: number): string {
  const bare = word.replace(/[^A-Za-z]/g, "");
  if (bare.length < 5) {
    return word;
  }
  const roll = (stableHash(key) % 1000) / 1000;
  if (roll >= chance) {
    return word;
  }

  const chars = word.split("");
  const letterIndices = chars
    .map((char, index) => ({ char, index }))
    .filter((entry) => /[A-Za-z]/.test(entry.char))
    .map((entry) => entry.index);
  if (letterIndices.length < 4) {
    return word;
  }
  const left = letterIndices[1]!;
  const right = letterIndices[letterIndices.length - 2]!;
  const temp = chars[left];
  chars[left] = chars[right]!;
  chars[right] = temp!;
  return chars.join("");
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
