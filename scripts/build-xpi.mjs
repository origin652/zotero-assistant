import { spawnSync } from "node:child_process";

const result = spawnSync("python3", ["scripts/build_xpi.py"], {
  cwd: process.cwd(),
  encoding: "utf8"
});

if (result.status !== 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.status || 1);
}
