import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const stylesheet = readFileSync(resolve(currentDir, "../src/ui/styles.css"), "utf8");

describe("mobile readability css", () => {
  test("EH-TW-067 includes text scale variants", () => {
    expect(stylesheet).toContain('.app-root[data-text-scale="default"]');
    expect(stylesheet).toContain('.app-root[data-text-scale="large"]');
    expect(stylesheet).toContain('.app-root[data-text-scale="xlarge"]');
  });

  test("EH-TW-068 enforces 44px-equivalent mobile target sizes", () => {
    expect(stylesheet).toMatch(/button\s*\{[\s\S]*min-height:\s*2\.75rem;/);
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.tab-button\s*\{[\s\S]*min-height:\s*3\.2rem;/);
    expect(stylesheet).toMatch(/@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.status-strip span,\s*[\s\S]*\.chip\s*\{[\s\S]*min-height:\s*2\.2rem;/);
  });
});
