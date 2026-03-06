import path from "node:path";
import {
  ROOT_DIR,
  ITCH_STATE_PATH,
  buildChangelogTemplate,
  bumpPatchVersion,
  ensureReleaseDirectories,
  ensureReleaseIndexes,
  formatBuildId,
  formatReleaseId,
  formatReleaseLabel,
  getUtcDateStamp,
  loadItchState,
  readAndValidateChangelog,
  readPackageJson,
  reserveNextBuild,
  scaffoldChangelog,
  toRepoRelativePath,
  writeJsonFile
} from "./release_utils";

function main() {
  ensureReleaseDirectories();
  ensureReleaseIndexes();

  const packageJson = readPackageJson();
  const state = loadItchState();

  let pending = state.pending;
  let nextState = state;

  if (!pending) {
    const dateStamp = getUtcDateStamp();
    const reserved = reserveNextBuild(state, dateStamp);
    nextState = reserved.nextState;
    const targetVersion = bumpPatchVersion(packageJson.version);
    const buildId = formatBuildId(dateStamp, reserved.sequence);
    const releaseId = formatReleaseId(targetVersion, buildId);
    const releaseLabel = formatReleaseLabel(targetVersion, buildId);
    const notesPath = `release/platforms/itch/releases/${releaseId}/CHANGELOG.md`;
    pending = {
      platform: "itch",
      targetVersion,
      buildId,
      releaseId,
      releaseLabel,
      notesPath,
      createdAtUtc: new Date().toISOString()
    };
    nextState.pending = pending;
    writeJsonFile(ITCH_STATE_PATH, nextState);
  }

  const notesAbsolutePath = path.join(ROOT_DIR, pending.notesPath);
  scaffoldChangelog(notesAbsolutePath, pending.releaseLabel);

  const { errors } = readAndValidateChangelog(notesAbsolutePath);
  if (errors.length > 0) {
    console.error(`Release notes are required before publishing ${pending.releaseLabel}.`);
    console.error(`Edit: ${toRepoRelativePath(notesAbsolutePath)}`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    const templatePreview = buildChangelogTemplate(pending.releaseLabel)
      .split(/\r?\n/)
      .slice(0, 14)
      .join("\n");
    console.error("\nTemplate preview:\n");
    console.error(templatePreview);
    process.exit(1);
  }

  console.log(`Release preflight ready: ${pending.releaseLabel}`);
  console.log(`Notes: ${toRepoRelativePath(notesAbsolutePath)}`);
}

main();
