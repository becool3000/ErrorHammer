import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

interface PackageJson {
  version: string;
}

interface ReleaseMeta {
  releaseLabel?: string;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const releaseMetaPath = path.join(rootDir, "src", "generated", "release.meta.json");
const distDir = path.join(rootDir, "dist");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as PackageJson;
const version = packageJson.version;
const releaseMeta = existsSync(releaseMetaPath) ? (JSON.parse(readFileSync(releaseMetaPath, "utf-8")) as ReleaseMeta) : null;
const releaseLabel = releaseMeta?.releaseLabel || `v${version}`;
const zipName = `error-hammer-${releaseLabel}-itch.zip`;
const zipPath = path.join(rootDir, zipName);

if (!existsSync(distDir)) {
  throw new Error("Missing dist/ output. Run `npm run build` before packaging itch zip.");
}

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

let result;
if (process.platform === "win32") {
  result = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `tar -a -c -f "..\\${zipName}" *`],
    { cwd: distDir, stdio: "inherit" }
  );
} else {
  result = spawnSync("tar", ["-a", "-c", "-f", zipPath, "."], { cwd: distDir, stdio: "inherit" });
}

if (result.status !== 0) {
  throw new Error("Itch zip packaging failed.");
}

console.log(`Created itch zip: ${zipName}`);
