import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export async function resolveAuth({ keychain, env = process.env, variable = "XAI_API_KEY" } = {}) {
  if (typeof keychain === "function") {
    try {
      const value = await keychain();
      if (value) return { source: "keychain", configured: true };
    } catch { /* environment fallback is intentional */ }
  }
  return { source: env?.[variable] ? "environment" : "none", configured: Boolean(env?.[variable]) };
}

export function redact(text, env = process.env) {
  let result = String(text ?? "");
  for (const [name, value] of Object.entries(env ?? {})) {
    if (/(?:KEY|TOKEN|SECRET|PASSWORD|AUTH)/i.test(name) && typeof value === "string" && value.length > 0) {
      result = result.split(value).join("[REDACTED]");
    }
  }
  result = result.replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, "$1 [REDACTED]");
  result = result.replace(/(?:api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s,;]+/gi, "$&".replace(/[^:=]+$/, "[REDACTED]"));
  return result;
}

export function assertNoTrackedSecrets(paths = []) {
  const files = paths.length ? paths : execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const keyLike = /(?:sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:api[_-]?key|token|secret)\s*[:=]\s*[A-Za-z0-9._-]{16,})/i;
  for (const path of files) {
    const content = readFileSync(path, "utf8");
    if (keyLike.test(content) && !/YOUR_API_KEY/.test(content)) throw new Error(`Tracked secret detected in ${path}`);
  }
  return true;
}
