import { spawn } from "node:child_process";

/** Ensures Next sees OPEN_NEXT=1 when OpenNext invokes `next build`. */
process.env.OPEN_NEXT = "1";

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/run-with-open-next.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(cmd, args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
