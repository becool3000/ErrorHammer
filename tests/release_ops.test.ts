import { describe, expect, it } from "vitest";
import {
  bumpPatchVersion,
  formatBuildId,
  formatReleaseArtifactName,
  formatReleaseLabel,
  reserveNextBuild,
  validateChangelogContent
} from "../scripts/release_utils";

describe("release ops helpers", () => {
  it("bumps semver patch", () => {
    expect(bumpPatchVersion("0.1.0")).toBe("0.1.1");
    expect(bumpPatchVersion("1.9.9")).toBe("1.9.10");
  });

  it("formats build ids and release labels", () => {
    const buildId = formatBuildId("20260304", 3);
    expect(buildId).toBe("itch.20260304.03");
    expect(formatReleaseLabel("0.1.7", buildId)).toBe("v0.1.7+itch.20260304.03");
    expect(formatReleaseArtifactName("v0.1.7+itch.20260304.03")).toBe("error-hammer-v0.1.7+itch.20260304.03-itch.zip");
  });

  it("increments sequence per UTC day", () => {
    const state = {
      lastUtcDate: "20260304",
      lastSequence: 4,
      pending: null
    };
    const sameDay = reserveNextBuild(state, "20260304");
    expect(sameDay.sequence).toBe(5);
    const nextDay = reserveNextBuild(state, "20260305");
    expect(nextDay.sequence).toBe(1);
  });

  it("fails changelog validation when placeholders remain", () => {
    const markdown = `# Itch Release v0.1.2+itch.20260304.01

## Added
- TODO: Added item 1
`;
    const errors = validateChangelogContent(markdown);
    expect(errors.some((entry) => entry.includes("Added"))).toBe(true);
    expect(errors.some((entry) => entry.includes("Changed"))).toBe(true);
  });

  it("passes changelog validation when all required sections are filled", () => {
    const markdown = `# Itch Release v0.1.2+itch.20260304.01

## Added
- Added release metadata UI.

## Changed
- Changed packaging to release label naming.

## Fixed
- Fixed inconsistent zip filename.

## Balance
- Balanced payout floor messaging.

## Content
- Added release registry files.

## UX/Mobile
- Improved settings info density on phones.

## Technical
- Added release scripts and manifest schema.

## Known Issues
- None at this time.
`;
    expect(validateChangelogContent(markdown)).toEqual([]);
  });
});
