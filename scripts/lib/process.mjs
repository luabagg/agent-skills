import { execFile } from "node:child_process";
import { spawn } from "node:child_process";

function checked({ executable, args }) {
  if (typeof executable !== "string" || !executable || !Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new TypeError("Process execution requires an executable and string args");
  }
}

export function spawnInherited({ executable, args, cwd, env }) {
  checked({ executable, args });
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status: status ?? 1 }));
  });
}

export function runProcess({ executable, args, cwd, env, capture = false }) {
  return capture ? execCaptured({ executable, args, cwd, env }) : spawnInherited({ executable, args, cwd, env });
}

export function execCaptured({ executable, args, cwd, env }) {
  checked({ executable, args });
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd, env, shell: false, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ status: 0, stdout, stderr });
    });
  });
}
