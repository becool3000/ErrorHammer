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
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.tab-button\s*\{[\s\S]*min-height:\s*2\.86rem;/);
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

  test("EH-TW-276 defines blueprint-pattern layers and parallax tokens", () => {
    expect(stylesheet).toContain("--parallax-y:");
    expect(stylesheet).toContain("--parallax-y-strong:");
    expect(stylesheet).toContain(".app-root::before");
    expect(stylesheet).toContain(".app-root::after");
  });

  test("EH-TW-277 defines shared glass tokens and applies them to main panels/nav", () => {
    expect(stylesheet).toContain("--glass-fill:");
    expect(stylesheet).toContain("--glass-border:");
    expect(stylesheet).toContain("--glass-blur:");
    expect(stylesheet).toMatch(/\.chrome-card\s*\{[\s\S]*backdrop-filter:\s*none;/);
    expect(stylesheet).toMatch(/\.bottom-nav\s*\{[\s\S]*backdrop-filter:\s*none;/);
  });

  test("EH-TW-278 supports reduced FX/motion parallax fallbacks", () => {
    expect(stylesheet).toContain('.app-root[data-fx-mode="reduced"]::before');
    expect(stylesheet).toContain('.app-root[data-fx-mode="reduced"]::after');
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*\.app-root::before[\s\S]*\.app-root::after/);
  });

  test("EH-TW-279 adds blue-contrast tuning for competitor news/tools and preserves modal store scroll reach", () => {
    expect(stylesheet).toContain(".competitor-news-surface .competitor-news-panel");
    expect(stylesheet).toContain(".competitor-news-surface .competitor-news-row");
    expect(stylesheet).toContain(".skills-surface .skills-panel");
    expect(stylesheet).toContain(".skills-surface .skills-row");
    expect(stylesheet).toContain(".store-visibility-boost .chrome-card");
    expect(stylesheet).toContain(".store-visibility-boost .tool-card");
    expect(stylesheet).toContain(".modal-shell.competitor-news-modal");
    expect(stylesheet).toContain(".sheet-shell.competitor-news-modal");
    expect(stylesheet).toContain(".modal-shell.store-supplies-modal");
    expect(stylesheet).toContain(".sheet-shell.store-supplies-modal");
    expect(stylesheet).toContain(".modal-shell.skills-modal");
    expect(stylesheet).toContain(".sheet-shell.skills-modal");
    expect(stylesheet).toContain(".modal-shell.competitor-news-modal .overlay-header");
    expect(stylesheet).toContain(".modal-shell.store-supplies-modal .overlay-header");
    expect(stylesheet).toContain(".modal-shell.skills-modal .overlay-header");
    expect(stylesheet).toContain(".overlay-body > .store-tab.store-visibility-boost");
    expect(stylesheet).toMatch(/\.overlay-body\s*\{[\s\S]*overscroll-behavior:\s*contain;/);
    expect(stylesheet).toMatch(/\.overlay-body\s*>\s*\.store-tab\.store-visibility-boost\s*\{[\s\S]*padding-bottom:\s*max\(5\.8rem,/);
    expect(stylesheet).toMatch(/\.collapsible-panel\.tool-group-panel\.open\s*\{[\s\S]*max-height:\s*999rem;/);
    expect(stylesheet).toMatch(/\.collapsible-panel\.tool-group-panel\.open\s*\{[\s\S]*overflow:\s*visible;/);
  });
});

