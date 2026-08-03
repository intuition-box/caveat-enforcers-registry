import { spawnSync } from "node:child_process";

const binPath = `${process.cwd()}/node_modules/.bin`;
const path = process.env.PATH ? `${binPath}:${process.env.PATH}` : binPath;
const steps = [
  ["node", ["scripts/check-docs.mjs"]],
  ["tsc", ["--noEmit"]],
  ["tsc", ["-p", "tsconfig.web.json", "--noEmit"]],
  ["vite", ["build"]],
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    env: { ...process.env, PATH: path },
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`Build step failed to start: ${command}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
