/**
 * Permission list for secret env files.
 *
 * Blocks read/write/edit and shell access to paths in PERMISSIONS.
 * Optional overlay: ~/.pi/agent/extensions/env-permissions.json
 *
 * Install via Agentfolio pi setup (copies to ~/.pi/agent/extensions/).
 * Restart pi or /reload so the handler is registered.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir, isToolCallEventType } from "@earendil-works/pi-coding-agent";

type Permissions = {
  denyRead: string[];
  denyWrite: string[];
};

const PERMISSIONS: Permissions = {
  denyRead: [".env", ".env.*"],
  denyWrite: [".env", ".env.*"],
};

const PATH_TOOLS = new Set(["read", "write", "edit"]);
const WRITE_TOOLS = new Set(["write", "edit"]);

function loadPermissions(): Permissions {
  const overlayPath = join(getAgentDir(), "extensions", "env-permissions.json");
  if (!existsSync(overlayPath)) {
    return PERMISSIONS;
  }
  try {
    const overlay = JSON.parse(readFileSync(overlayPath, "utf8")) as Partial<Permissions>;
    return {
      denyRead: overlay.denyRead ?? PERMISSIONS.denyRead,
      denyWrite: overlay.denyWrite ?? PERMISSIONS.denyWrite,
    };
  } catch {
    return PERMISSIONS;
  }
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DS::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DS::/g, ".*");
  return new RegExp(`(?:^|/)${escaped}$`);
}

function pathMatches(path: string, pattern: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  const re = globToRegExp(pattern);
  if (re.test(normalized)) {
    return true;
  }
  const base = normalized.split("/").pop() ?? normalized;
  return re.test(base);
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, out);
    }
  }
  return out;
}

function commandTouches(command: string, pattern: string): boolean {
  const re = globToRegExp(pattern);
  if (re.test(command.trim())) {
    return true;
  }
  const tokenRe = new RegExp(
    `(?:^|[\\s'"=\`])(?:\\./)?${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^\\s'\"|&;<>]*")}(?:$|[\\s'"|&;<>])`,
  );
  return tokenRe.test(command);
}

function deniedBy(value: string, patterns: string[]): string | undefined {
  return patterns.find((pattern) => pathMatches(value, pattern) || commandTouches(value, pattern));
}

export default function (pi: ExtensionAPI) {
  const permissions = loadPermissions();

  pi.on("tool_call", async (event, ctx) => {
    const patterns = WRITE_TOOLS.has(event.toolName)
      ? [...permissions.denyRead, ...permissions.denyWrite]
      : permissions.denyRead;

    if (isToolCallEventType("bash", event)) {
      const bashPatterns = [...permissions.denyRead, ...permissions.denyWrite];
      const hit = deniedBy(event.input.command, bashPatterns);
      if (!hit) {
        return undefined;
      }
      if (ctx.hasUI) {
        ctx.ui.notify(`Blocked bash access to ${hit}`, "warning");
      }
      return {
        block: true,
        reason: `Permission list denies ${hit} (never read .env files)`,
      };
    }

    if (!PATH_TOOLS.has(event.toolName)) {
      const hit = collectStrings(event.input)
        .map((value) => deniedBy(value, patterns))
        .find((pattern) => pattern !== undefined);
      if (!hit) {
        return undefined;
      }
      if (ctx.hasUI) {
        ctx.ui.notify(`Blocked ${event.toolName} access to ${hit}`, "warning");
      }
      return {
        block: true,
        reason: `Permission list denies ${hit} (never read .env files)`,
      };
    }

    const path = String(
      (event.input as { path?: unknown }).path ?? "",
    );
    if (!path) {
      return undefined;
    }
    const hit = deniedBy(path, patterns);
    if (!hit) {
      return undefined;
    }
    if (ctx.hasUI) {
      ctx.ui.notify(`Blocked ${event.toolName} of ${path}`, "warning");
    }
    return {
      block: true,
      reason: `Permission list denies ${hit}: ${path}`,
    };
  });
}
