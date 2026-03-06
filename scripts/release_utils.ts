import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ReleaseRuntimeMeta {
  appVersion: string;
  buildId: string;
  releaseLabel: string;
  gitCommit: string;
  builtAtUtc: string;
}

export interface ItchPendingRelease {
  platform: "itch";
  targetVersion: string;
  buildId: string;
  releaseId: string;
  releaseLabel: string;
  notesPath: string;
  createdAtUtc: string;
}

export interface ItchReleaseState {
  lastUtcDate: string;
  lastSequence: number;
  pending: ItchPendingRelease | null;
}

export interface ItchReleaseManifest {
  releaseId: string;
  platform: "itch";
  version: string;
  buildId: string;
  releaseLabel: string;
  tag: string;
  gitCommit: string;
  artifactName: string;
  artifactSha256: string;
  artifactBytes: number;
  builtAtUtc: string;
  notesPath: string;
  highlights: string[];
}

export interface ItchReleaseIndex {
  platform: "itch";
  latestReleaseId: string | null;
  releases: Array<{
    releaseId: string;
    version: string;
    buildId: string;
    releaseLabel: string;
    builtAtUtc: string;
    notesPath: string;
    artifactName: string;
    tag: string;
  }>;
}

export interface GlobalReleaseIndex {
  latestByPlatform: Record<string, string>;
  releases: Array<{
    releaseId: string;
    platform: string;
    version: string;
    buildId: string;
    releaseLabel: string;
    builtAtUtc: string;
    notesPath: string;
    manifestPath: string;
  }>;
}

interface PackageJson {
  version: string;
  scripts?: Record<string, string>;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(scriptDir, "..");
export const RELEASE_DIR = path.join(ROOT_DIR, "release");
export const RELEASE_TEMPLATE_DIR = path.join(RELEASE_DIR, "templates");
export const ITCH_DIR = path.join(RELEASE_DIR, "platforms", "itch");
export const ITCH_RELEASES_DIR = path.join(ITCH_DIR, "releases");
export const ITCH_STATE_PATH = path.join(ITCH_DIR, "state.json");
export const ITCH_INDEX_PATH = path.join(ITCH_DIR, "index.json");
export const GLOBAL_INDEX_PATH = path.join(RELEASE_DIR, "index.json");
export const PACKAGE_JSON_PATH = path.join(ROOT_DIR, "package.json");
export const RELEASE_META_PATH = path.join(ROOT_DIR, "src", "generated", "release.meta.json");
export const CHANGELOG_TEMPLATE_PATH = path.join(RELEASE_TEMPLATE_DIR, "changelog.itch.md");

const REQUIRED_CHANGELOG_SECTIONS = [
  "Added",
  "Changed",
  "Fixed",
  "Balance",
  "Content",
  "UX/Mobile",
  "Technical",
  "Known Issues"
];
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const UTC_DATE_STAMP_PATTERN = /^\d{8}$/;
const MIN_BUILD_SEQUENCE = 1;
const MAX_BUILD_SEQUENCE = 99;

export function ensureReleaseDirectories(): void {
  mkdirSync(RELEASE_TEMPLATE_DIR, { recursive: true });
  mkdirSync(ITCH_RELEASES_DIR, { recursive: true });
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export function readPackageJson(): PackageJson {
  return readJsonFile<PackageJson>(PACKAGE_JSON_PATH, { version: "0.1.0" });
}

export function writePackageVersion(nextVersion: string): void {
  const packageJson = readPackageJson();
  packageJson.version = nextVersion;
  writeJsonFile(PACKAGE_JSON_PATH, packageJson);
}

export function bumpPatchVersion(version: string): string {
  const match = SEMVER_PATTERN.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid semver version "${version}". Expected X.Y.Z`);
  }
  const [, majorRaw, minorRaw, patchRaw] = match;
  const major = Number.parseInt(majorRaw ?? "", 10);
  const minor = Number.parseInt(minorRaw ?? "", 10);
  const patch = Number.parseInt(patchRaw ?? "", 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    throw new Error(`Invalid semver version "${version}". Expected X.Y.Z`);
  }
  return `${major}.${minor}.${patch + 1}`;
}

export function getUtcDateStamp(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

export function formatBuildId(dateStamp: string, sequence: number): string {
  if (!UTC_DATE_STAMP_PATTERN.test(dateStamp)) {
    throw new Error(`Invalid UTC date stamp "${dateStamp}". Expected YYYYMMDD.`);
  }
  if (!Number.isInteger(sequence) || sequence < MIN_BUILD_SEQUENCE || sequence > MAX_BUILD_SEQUENCE) {
    throw new Error(`Invalid build sequence "${sequence}". Expected integer 1-99.`);
  }
  return `itch.${dateStamp}.${`${sequence}`.padStart(2, "0")}`;
}

export function formatReleaseLabel(version: string, buildId: string): string {
  return `v${version}+${buildId}`;
}

export function formatReleaseId(version: string, buildId: string): string {
  return formatReleaseLabel(version, buildId);
}

export function formatReleaseArtifactName(releaseLabel: string): string {
  return `error-hammer-${releaseLabel}-itch.zip`;
}

export function getDefaultReleaseMeta(appVersion = "0.1.0"): ReleaseRuntimeMeta {
  return {
    appVersion,
    buildId: "dev-local",
    releaseLabel: `v${appVersion}+dev-local`,
    gitCommit: "dev",
    builtAtUtc: ""
  };
}

export function loadItchState(): ItchReleaseState {
  return readJsonFile<ItchReleaseState>(ITCH_STATE_PATH, {
    lastUtcDate: "",
    lastSequence: 0,
    pending: null
  });
}

export function reserveNextBuild(state: ItchReleaseState, dateStamp: string): { nextState: ItchReleaseState; sequence: number } {
  if (!UTC_DATE_STAMP_PATTERN.test(dateStamp)) {
    throw new Error(`Invalid UTC date stamp "${dateStamp}". Expected YYYYMMDD.`);
  }
  const sequence = state.lastUtcDate === dateStamp ? state.lastSequence + 1 : 1;
  if (sequence > MAX_BUILD_SEQUENCE) {
    throw new Error(`Daily build sequence exceeded for ${dateStamp}. Maximum supported sequence is ${MAX_BUILD_SEQUENCE}.`);
  }
  return {
    sequence,
    nextState: {
      ...state,
      lastUtcDate: dateStamp,
      lastSequence: sequence
    }
  };
}

export function buildChangelogTemplate(releaseLabel: string): string {
  return `# Itch Release ${releaseLabel}

## Added
- TODO: Added item 1

## Changed
- TODO: Changed item 1

## Fixed
- TODO: Fixed item 1

## Balance
- TODO: Balance item 1

## Content
- TODO: Content item 1

## UX/Mobile
- TODO: UX/Mobile item 1

## Technical
- TODO: Technical item 1

## Known Issues
- TODO: Known issue item 1
`;
}

export function ensureChangelogTemplate(): void {
  if (existsSync(CHANGELOG_TEMPLATE_PATH)) {
    return;
  }
  mkdirSync(path.dirname(CHANGELOG_TEMPLATE_PATH), { recursive: true });
  writeFileSync(CHANGELOG_TEMPLATE_PATH, buildChangelogTemplate("v0.0.0+itch.YYYYMMDD.NN"), "utf-8");
}

export function scaffoldChangelog(notesAbsolutePath: string, releaseLabel: string): void {
  if (existsSync(notesAbsolutePath)) {
    return;
  }
  ensureChangelogTemplate();
  const template = readFileSync(CHANGELOG_TEMPLATE_PATH, "utf-8");
  const content = template.replace(/v0\.0\.0\+itch\.YYYYMMDD\.NN/g, releaseLabel);
  mkdirSync(path.dirname(notesAbsolutePath), { recursive: true });
  writeFileSync(notesAbsolutePath, content, "utf-8");
}

export function parseChangelogSections(markdown: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const headingMatch = /^##\s+(.+)$/.exec(line);
    if (headingMatch) {
      current = headingMatch[1];
      if (!sections[current]) {
        sections[current] = [];
      }
      continue;
    }
    if (!current || !line) {
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}

export function validateChangelogContent(markdown: string): string[] {
  const errors: string[] = [];
  const sections = parseChangelogSections(markdown);

  for (const section of REQUIRED_CHANGELOG_SECTIONS) {
    if (!sections[section]) {
      errors.push(`Missing required section: ${section}`);
      continue;
    }
    const bullets = sections[section].filter((line) => line.startsWith("- "));
    if (bullets.length === 0) {
      errors.push(`Section "${section}" must contain at least one bullet.`);
      continue;
    }
    const placeholderLine = bullets.find((line) => /TODO|TBD|<fill>|\[ \]/i.test(line));
    if (placeholderLine) {
      errors.push(`Section "${section}" has placeholder text: "${placeholderLine}"`);
    }
  }

  return errors;
}

export function readAndValidateChangelog(notesAbsolutePath: string): { errors: string[]; markdown: string } {
  if (!existsSync(notesAbsolutePath)) {
    return { errors: [`Missing changelog file: ${notesAbsolutePath}`], markdown: "" };
  }
  const markdown = readFileSync(notesAbsolutePath, "utf-8");
  const errors = validateChangelogContent(markdown);
  return { errors, markdown };
}

export function extractHighlights(markdown: string): string[] {
  const sections = parseChangelogSections(markdown);
  const highlightSections = ["Added", "Changed", "Fixed"];
  const highlights: string[] = [];
  for (const sectionName of highlightSections) {
    const lines = sections[sectionName] ?? [];
    const bullet = lines.find((line) => line.startsWith("- "));
    if (bullet) {
      highlights.push(bullet.replace(/^- /, "").trim());
    }
  }
  return highlights.slice(0, 6);
}

export function ensureReleaseIndexes(): void {
  const itchIndex = readJsonFile<ItchReleaseIndex>(ITCH_INDEX_PATH, {
    platform: "itch",
    latestReleaseId: null,
    releases: []
  });
  writeJsonFile(ITCH_INDEX_PATH, itchIndex);

  const globalIndex = readJsonFile<GlobalReleaseIndex>(GLOBAL_INDEX_PATH, {
    latestByPlatform: {},
    releases: []
  });
  writeJsonFile(GLOBAL_INDEX_PATH, globalIndex);
}

export function toRepoRelativePath(absolutePath: string): string {
  return path.relative(ROOT_DIR, absolutePath).replace(/\\/g, "/");
}
