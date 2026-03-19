import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

interface PublishOptions {
  target: string;
  targetUrl: string;
  channel: string;
  dryRun: boolean;
  artifactPath?: string;
}

interface ReleaseMeta {
  releaseLabel?: string;
}

const DEFAULT_ITCH_TARGET_URL = "https://becool3000.itch.io/error-hammer";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const releaseMetaPath = path.join(rootDir, "src", "generated", "release.meta.json");

function runCommand(command: string, args: string[], description: string): void {
  console.log(`[publish:itch] ${description}`);
  const result = spawnSync(command, args, { cwd: rootDir, stdio: "inherit" });
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

function deriveTargetFromUrl(targetUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error(`Invalid itch URL: ${targetUrl}`);
  }

  const hostParts = parsed.hostname.split(".");
  const owner = hostParts.length >= 3 && hostParts[1] === "itch" && hostParts[2] === "io" ? hostParts[0] : "";
  const game = parsed.pathname.split("/").filter(Boolean)[0] ?? "";

  if (!owner || !game) {
    throw new Error(`Expected an itch URL like https://owner.itch.io/game, got: ${targetUrl}`);
  }

  return `${owner}/${game}`;
}

function readReleaseLabel(): string | null {
  if (!existsSync(releaseMetaPath)) {
    return null;
  }
  try {
    const meta = JSON.parse(readFileSync(releaseMetaPath, "utf-8")) as ReleaseMeta;
    return meta.releaseLabel ?? null;
  } catch {
    return null;
  }
}

function getArtifactReleaseLabel(artifactPath: string): string {
  const baseName = path.basename(artifactPath);
  const match = /^error-hammer-(.+)-itch\.zip$/i.exec(baseName);
  if (!match?.[1]) {
    const fallback = readReleaseLabel();
    if (fallback) {
      return fallback;
    }
    throw new Error(`Unable to derive release label from artifact name: ${baseName}`);
  }
  return match[1];
}

function getLatestArtifactPath(): string {
  const candidates = readdirSync(rootDir)
    .filter((entry) => /^error-hammer-.*-itch\.zip$/i.test(entry))
    .map((entry) => path.join(rootDir, entry))
    .filter((entry) => existsSync(entry))
    .map((entry) => ({
      path: entry,
      mtimeMs: statSync(entry).mtimeMs
    }))
    .sort((left, right) => {
      if (right.mtimeMs !== left.mtimeMs) {
        return right.mtimeMs - left.mtimeMs;
      }
      return path.basename(right.path).localeCompare(path.basename(left.path));
    });

  if (candidates.length === 0) {
    throw new Error("No itch zip artifact found. Run `npm run build:itch` first.");
  }

  return candidates[0]?.path ?? "";
}

function parseArgs(argv: string[]): PublishOptions {
  const options: PublishOptions = {
    target: process.env.ITCH_TARGET ?? "",
    targetUrl: process.env.ITCH_TARGET_URL ?? DEFAULT_ITCH_TARGET_URL,
    channel: process.env.ITCH_CHANNEL ?? "",
    dryRun: process.env.ITCH_DRY_RUN === "1"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) {
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--target") {
      options.target = argv[i + 1] ?? options.target;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
      continue;
    }
    if (arg === "--target-url") {
      options.targetUrl = argv[i + 1] ?? options.targetUrl;
      i += 1;
      continue;
    }
    if (arg.startsWith("--target-url=")) {
      options.targetUrl = arg.slice("--target-url=".length);
      continue;
    }
    if (arg === "--channel") {
      options.channel = argv[i + 1] ?? options.channel;
      i += 1;
      continue;
    }
    if (arg.startsWith("--channel=")) {
      options.channel = arg.slice("--channel=".length);
      continue;
    }
    if (arg === "--artifact") {
      options.artifactPath = path.resolve(rootDir, argv[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (arg.startsWith("--artifact=")) {
      options.artifactPath = path.resolve(rootDir, arg.slice("--artifact=".length));
      continue;
    }
    if (!options.target && !arg.startsWith("--")) {
      options.target = arg;
    }
  }

  if (!options.target && options.targetUrl) {
    options.target = deriveTargetFromUrl(options.targetUrl);
  }

  if (!options.channel) {
    options.channel = options.targetUrl ? "web" : "windows";
  }

  if (!options.target && !options.dryRun) {
    throw new Error("Missing itch target. Set ITCH_TARGET, ITCH_TARGET_URL, or pass `--target owner/game`.");
  }

  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const npmRunner = getNpmRunner();

  runCommand(npmRunner.command, [...npmRunner.baseArgs, "run", "build:itch"], "build latest itch artifact");

  const artifactPath = options.artifactPath ?? getLatestArtifactPath();
  if (!existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }

  const releaseLabel = getArtifactReleaseLabel(artifactPath);
  const butlerTarget = `${options.target}:${options.channel}`;

  console.log(`[publish:itch] artifact: ${path.relative(rootDir, artifactPath)}`);
  console.log(`[publish:itch] target: ${butlerTarget}`);
  console.log(`[publish:itch] userversion: ${releaseLabel}`);

  if (options.dryRun) {
    console.log("[publish:itch] dry run only; upload skipped.");
    return;
  }

  runCommand(
    "butler",
    ["push", artifactPath, butlerTarget, "--userversion", releaseLabel, "--fix-permissions"],
    "upload artifact with butler"
  );

  console.log("[publish:itch] upload complete.");
}

main();
