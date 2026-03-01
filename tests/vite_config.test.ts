import { describe, expect, test } from "vitest";
import viteConfig from "../vite.config";

describe("itch packaging config", () => {
  test("EH-TW-022 uses a relative base path for HTML uploads", () => {
    expect(viteConfig.base).toBe("./");
  });
});
