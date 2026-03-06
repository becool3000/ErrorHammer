import generatedReleaseMeta from "../generated/release.meta.json";

export interface ReleaseInfo {
  appVersion: string;
  buildId: string;
  releaseLabel: string;
  gitCommit: string;
  builtAtUtc: string;
}

function normalizeReleaseInfo(value: unknown): ReleaseInfo {
  const fallback: ReleaseInfo = {
    appVersion: __APP_VERSION__,
    buildId: "dev-local",
    releaseLabel: `v${__APP_VERSION__}+dev-local`,
    gitCommit: "dev",
    builtAtUtc: ""
  };
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const source = value as Partial<ReleaseInfo>;
  return {
    appVersion: source.appVersion?.trim() || fallback.appVersion,
    buildId: source.buildId?.trim() || fallback.buildId,
    releaseLabel: source.releaseLabel?.trim() || fallback.releaseLabel,
    gitCommit: source.gitCommit?.trim() || fallback.gitCommit,
    builtAtUtc: source.builtAtUtc?.trim() || fallback.builtAtUtc
  };
}

export const releaseInfo = normalizeReleaseInfo(generatedReleaseMeta);
