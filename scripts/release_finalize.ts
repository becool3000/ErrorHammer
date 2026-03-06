import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  GLOBAL_INDEX_PATH,
  ITCH_INDEX_PATH,
  ITCH_STATE_PATH,
  RELEASE_META_PATH,
  ROOT_DIR,
  ItchReleaseIndex,
  ItchReleaseManifest,
  ItchReleaseState,
  GlobalReleaseIndex,
  ensureReleaseDirectories,
  ensureReleaseIndexes,
  extractHighlights,
  formatReleaseArtifactName,
  readAndValidateChangelog,
  readJsonFile,
  toRepoRelativePath,
  writeJsonFile,
  writePackageVersion
} from "./release_utils";

function runCommand(command: string, args: string[], description: string): void {
  console.log(`[release:finalize] ${description}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Command failed for ${description}: ${command} ${args.join(" ")}`);
  }
}

function getNpmRunner(): { command: string; baseArgs: string[] } {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && npmExecPath.length > 0) {
    return { command: process.execPath, baseArgs: [npmExecPath] };
  }
  return { command: process.platform === "win32" ? "npm.cmd" : "npm", baseArgs: [] };
}

function runCapture(command: string, args: string[]): string {
  const result = spawnSync(command, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf-8" });
  if (result.status !== 0) {
    return "";
  }
  return `${result.stdout ?? ""}`.trim();
}

function computeSha256(filePath: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function appendVaultEntry(filePath: string, heading: string, line: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  if (!existsSync(filePath)) {
    writeFileSync(filePath, `# ${heading}\n\n${line}\n`, "utf-8");
    return;
  }
  const existing = readFileSync(filePath, "utf-8");
  const prefix = existing.endsWith("\n") ? existing : `${existing}\n`;
  writeFileSync(filePath, `${prefix}${line}\n`, "utf-8");
}

function main() {
  ensureReleaseDirectories();
  ensureReleaseIndexes();

  const state = readJsonFile<ItchReleaseState>(ITCH_STATE_PATH, {
    lastUtcDate: "",
    lastSequence: 0,
    pending: null
  });
  if (!state.pending) {
    throw new Error("No pending release found. Run `npm run release:prepare` first.");
  }
  const pending = state.pending;
  const notesAbsolutePath = path.join(ROOT_DIR, pending.notesPath);
  const notesValidation = readAndValidateChangelog(notesAbsolutePath);
  if (notesValidation.errors.length > 0) {
    throw new Error(
      `Release notes are not ready. Fix ${toRepoRelativePath(notesAbsolutePath)}:\n${notesValidation.errors
        .map((line) => `- ${line}`)
        .join("\n")}`
    );
  }

  writePackageVersion(pending.targetVersion);
  const gitCommand = "git";
  const shortCommit = runCapture(gitCommand, ["rev-parse", "--short", "HEAD"]) || "nogit";
  const builtAtUtc = new Date().toISOString();
  const releaseMeta = {
    appVersion: pending.targetVersion,
    buildId: pending.buildId,
    releaseLabel: pending.releaseLabel,
    gitCommit: shortCommit,
    builtAtUtc
  };
  writeJsonFile(RELEASE_META_PATH, releaseMeta);

  const npmRunner = getNpmRunner();
  runCommand(npmRunner.command, [...npmRunner.baseArgs, "run", "content:compile"], "content compile");
  runCommand(npmRunner.command, [...npmRunner.baseArgs, "run", "build"], "production build");
  runCommand(npmRunner.command, [...npmRunner.baseArgs, "run", "itch:zip"], "itch zip packaging");

  const artifactName = formatReleaseArtifactName(pending.releaseLabel);
  const artifactPath = path.join(ROOT_DIR, artifactName);
  if (!existsSync(artifactPath)) {
    throw new Error(`Expected release artifact not found: ${artifactName}`);
  }
  const artifactSha256 = computeSha256(artifactPath);
  const artifactBytes = statSync(artifactPath).size;
  const highlights = extractHighlights(notesValidation.markdown);
  const tagName = `itch/${pending.releaseLabel}`;
  const existingTag = runCapture(gitCommand, ["tag", "--list", tagName]);
  if (!existingTag) {
    runCommand(gitCommand, ["tag", "-a", tagName, "-m", `Itch release ${pending.releaseLabel}`], `create git tag ${tagName}`);
  }

  const releaseManifest: ItchReleaseManifest = {
    releaseId: pending.releaseId,
    platform: "itch",
    version: pending.targetVersion,
    buildId: pending.buildId,
    releaseLabel: pending.releaseLabel,
    tag: tagName,
    gitCommit: shortCommit,
    artifactName,
    artifactSha256,
    artifactBytes,
    builtAtUtc,
    notesPath: pending.notesPath,
    highlights
  };

  const releaseDir = path.join(ROOT_DIR, "release", "platforms", "itch", "releases", pending.releaseId);
  mkdirSync(releaseDir, { recursive: true });
  const releaseManifestPath = path.join(releaseDir, "release.json");
  writeJsonFile(releaseManifestPath, releaseManifest);

  const itchIndex = readJsonFile<ItchReleaseIndex>(ITCH_INDEX_PATH, {
    platform: "itch",
    latestReleaseId: null,
    releases: []
  });
  itchIndex.releases = [
    {
      releaseId: pending.releaseId,
      version: pending.targetVersion,
      buildId: pending.buildId,
      releaseLabel: pending.releaseLabel,
      builtAtUtc,
      notesPath: pending.notesPath,
      artifactName,
      tag: tagName
    },
    ...itchIndex.releases.filter((entry) => entry.releaseId !== pending.releaseId)
  ];
  itchIndex.latestReleaseId = pending.releaseId;
  writeJsonFile(ITCH_INDEX_PATH, itchIndex);

  const globalIndex = readJsonFile<GlobalReleaseIndex>(GLOBAL_INDEX_PATH, {
    latestByPlatform: {},
    releases: []
  });
  globalIndex.latestByPlatform.itch = pending.releaseId;
  const manifestPath = toRepoRelativePath(releaseManifestPath);
  globalIndex.releases = [
    {
      releaseId: pending.releaseId,
      platform: "itch",
      version: pending.targetVersion,
      buildId: pending.buildId,
      releaseLabel: pending.releaseLabel,
      builtAtUtc,
      notesPath: pending.notesPath,
      manifestPath
    },
    ...globalIndex.releases.filter((entry) => entry.releaseId !== pending.releaseId)
  ];
  writeJsonFile(GLOBAL_INDEX_PATH, globalIndex);

  appendVaultEntry(
    path.join(ROOT_DIR, "obsidian_vault", "Releases.md"),
    "Releases",
    `- ${builtAtUtc} | Itch ${pending.releaseLabel} | artifact \`${artifactName}\` | tag \`${tagName}\``
  );
  appendVaultEntry(
    path.join(ROOT_DIR, "obsidian_vault", "releases", "itch.md"),
    "Itch Releases",
    `- ${builtAtUtc} | ${pending.releaseLabel} | sha256 \`${artifactSha256.slice(0, 12)}...\` | notes [${pending.releaseId}](/${pending.notesPath})`
  );

  writeJsonFile(ITCH_STATE_PATH, {
    ...state,
    pending: null
  });

  console.log("\nRelease complete.");
  console.log(`Release: ${pending.releaseLabel}`);
  console.log(`Artifact: ${artifactName}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Tag: ${tagName}`);
}

main();
