import { spawnSync } from "node:child_process";

interface Step {
  label: string;
  args: string[];
}

const steps: Step[] = [
  { label: "content:validate", args: ["run", "content:validate"] },
  { label: "content:compile", args: ["run", "content:compile"] },
  { label: "test", args: ["run", "test"] },
  { label: "build", args: ["run", "build"] }
];

function main() {
  const npmExecPath = process.env.npm_execpath;
  const runner =
    npmExecPath && npmExecPath.length > 0
      ? { command: process.execPath, baseArgs: [npmExecPath] }
      : { command: process.platform === "win32" ? "npm.cmd" : "npm", baseArgs: [] as string[] };
  for (const step of steps) {
    console.log(`\n[release:verify] ${step.label}`);
    const result = spawnSync(runner.command, [...runner.baseArgs, ...step.args], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`Release verification failed at step "${step.label}".`);
    }
  }
}

main();
