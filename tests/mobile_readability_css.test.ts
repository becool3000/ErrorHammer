import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const stylesheet = readFileSync(resolve(currentDir, "../src/ui/styles.css"), "utf8");

describe("mobile readability css", () => {
  test("EH-TW-067 includes text scale variants", () => {
    expect(stylesheet).toContain('.app-root[data-text-scale="xsmall"]');
    expect(stylesheet).toContain('.app-root[data-text-scale="default"]');
    expect(stylesheet).toContain('.app-root[data-text-scale="large"]');
    expect(stylesheet).toContain('.app-root[data-text-scale="xlarge"]');
  });

  test("EH-TW-068 enforces 44px-equivalent mobile target sizes", () => {
    expect(stylesheet).toMatch(/button\s*\{[\s\S]*min-height:\s*2\.75rem;/);
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.tab-button\s*\{[\s\S]*min-height:\s*3\.2rem;/);
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.chip\s*\{[\s\S]*min-height:\s*2\.2rem;/);
    expect(stylesheet).toMatch(/\.status-strip span\s*\{[\s\S]*background:\s*transparent;/);
  });

  test("EH-TW-081 keeps next-step guidance text concise and wrap-safe", () => {
    expect(stylesheet).toMatch(/\.task-guidance\s*\{[\s\S]*font-size:\s*calc\(var\(--font-small\)\s*\*\s*var\(--ui-scale\)\);/);
    expect(stylesheet).toMatch(/\.task-guidance\s*\{[\s\S]*overflow-wrap:\s*anywhere;/);
  });

  test("EH-TW-102 defines neon semantic tone tokens and utility classes", () => {
    expect(stylesheet).toContain("--tone-info:");
    expect(stylesheet).toContain("--tone-success:");
    expect(stylesheet).toContain("--tone-warning:");
    expect(stylesheet).toContain("--tone-danger:");
    expect(stylesheet).toContain("--tone-energy:");
    expect(stylesheet).toContain(".tone-info");
    expect(stylesheet).toContain(".tone-success");
    expect(stylesheet).toContain(".tone-warning");
    expect(stylesheet).toContain(".tone-danger");
    expect(stylesheet).toContain(".tone-energy");
  });

  test("EH-TW-103 keeps reduced-motion fallback for neon glow effects", () => {
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain('.app-root[data-color-mode="neon"]');
  });
});

