import { spawnSync } from "node:child_process";

export const npx = process.platform === "win32" ? "npx.cmd" : "npx";

export function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function windowsQuote(value) {
  if (/^[A-Za-z0-9_./:@=*-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

export function runCommand(command, options = {}) {
  if (process.platform !== "win32") {
    return spawnSync(command[0], command.slice(1), options);
  }

  const commandLine = command.map(windowsQuote).join(" ");
  return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", commandLine], options);
}