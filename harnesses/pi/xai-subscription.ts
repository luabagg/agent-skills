/**
 * xAI Subscription (OAuth) provider for pi.
 *
 * Adds an `xai-subscription` provider that authenticates via xAI's OAuth
 * device-code flow against https://auth.x.ai (the same flow opencode uses),
 * then uses the resulting access token as a Bearer against https://api.x.ai/v1.
 *
 * Allowed models (hard cap):
 *   - grok-4.5
 *   - grok-composer-2.5-fast ("Composer 2.5 Fast")
 *
 * Usage:
 *   1. Install via `npm run setup:pi` from this repo (copies harnesses/pi/xai-subscription.ts
 *      to ~/.pi/agent/extensions/xai-subscription.ts), or copy the file manually
 *   2. Start pi, run `/login`, pick "xAI (Subscription)"
 *   3. Visit the verification URL, enter the code, approve
 *   4. Select a model with `/model`, e.g. xai-subscription/grok-4.5
 *
 * Credentials are persisted by pi in ~/.pi/agent/auth.json under
 * `xai-subscription` and auto-refreshed when expired.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/** pi's provider-model config shape (subset we use). */
interface ProviderModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// xAI OAuth constants (xAI's public OAuth endpoints, not a secret).
// ---------------------------------------------------------------------------

const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_DEVICE_AUTH_URL = "https://auth.x.ai/oauth2/device/code";
const XAI_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const XAI_SCOPES = "openid profile email offline_access grok-cli:access api:access";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

const XAI_UPSTREAM_BASE_URL = "https://api.x.ai/v1";
const HEADROOM_PROXY_BASE_URL = `${(process.env.HEADROOM_PROXY_URL?.trim() || "http://127.0.0.1:8787")
  .replace(/\/+$/, "")
  .replace(/\/v1$/, "")}/v1`;
const XAI_MODELS_URL = `${XAI_UPSTREAM_BASE_URL}/models`;
const AUTH_FILE = path.join(os.homedir(), ".pi", "agent", "auth.json");

// Hard cap: only these xAI model IDs are registered for this provider.
const ALLOWED_XAI_MODEL_IDS = new Set(["grok-4.5", "grok-composer-2.5-fast"]);

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300_000; // 5 min

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function formUrlEncoded(obj: Record<string, string>): string {
  return new URLSearchParams(obj).toString();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: formUrlEncoded(body),
  });
}

async function throwIfNotOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(`xAI ${label} failed (${res.status})${text ? `: ${text}` : ""}`);
}

// ---------------------------------------------------------------------------
// OAuth implementation
// ---------------------------------------------------------------------------

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in?: number;
  interval?: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const deviceRes = await postForm(XAI_DEVICE_AUTH_URL, {
    client_id: XAI_CLIENT_ID,
    scope: XAI_SCOPES,
  });
  await throwIfNotOk(deviceRes, "device code request");
  const device = (await deviceRes.json()) as DeviceCodeResponse;
  if (!device.device_code || !device.user_code || !device.verification_uri) {
    throw new Error("xAI device code response missing device_code / user_code / verification_uri");
  }

  callbacks.onDeviceCode({
    userCode: device.user_code,
    verificationUri: device.verification_uri,
    intervalSeconds: device.interval ?? Math.round(POLL_INTERVAL_MS / 1000),
    expiresInSeconds: device.expires_in ?? Math.round(POLL_TIMEOUT_MS / 1000),
  });

  const intervalMs = (device.interval ?? POLL_INTERVAL_MS / 1000) * 1000;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let currentInterval = intervalMs;

  // Poll the token endpoint until approved, denied, or expired.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await sleep(currentInterval);

    const tokenRes = await postForm(XAI_TOKEN_URL, {
      grant_type: DEVICE_GRANT_TYPE,
      client_id: XAI_CLIENT_ID,
      device_code: device.device_code,
    });

    if (tokenRes.ok) {
      const tokens = (await tokenRes.json()) as TokenResponse;
      return {
        access: tokens.access_token,
        refresh: tokens.refresh_token ?? "",
        expires: Date.now() + tokens.expires_in * 1000,
      };
    }

    const err = (await tokenRes.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };
    const code = err.error ?? "";

    if (code === "authorization_pending") {
      currentInterval = intervalMs;
      continue;
    }
    if (code === "slow_down") {
      currentInterval += 5000;
      continue;
    }
    if (code === "access_denied" || code === "authorization_denied") {
      throw new Error("xAI device authorization was denied");
    }
    if (code === "expired_token") {
      throw new Error("xAI device code expired - please re-run /login");
    }
    const desc = err.error_description ?? err.error ?? "";
    throw new Error(`xAI device token exchange failed (${tokenRes.status})${desc ? `: ${desc}` : ""}`);
  }
}

async function refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  if (!credentials.refresh) throw new Error("xAI refresh token missing - please /login again");
  const res = await postForm(XAI_TOKEN_URL, {
    grant_type: "refresh_token",
    refresh_token: credentials.refresh,
    client_id: XAI_CLIENT_ID,
  });
  await throwIfNotOk(res, "token refresh");
  const tokens = (await res.json()) as TokenResponse;
  return {
    access: tokens.access_token,
    refresh: tokens.refresh_token ?? credentials.refresh,
    expires: Date.now() + tokens.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Dynamic model discovery from https://api.x.ai/v1/models
// ---------------------------------------------------------------------------

// Shape of xAI's /v1/models entries (only fields we read).
interface XaiModel {
  id: string;
  aliases?: string[];
  context_length?: number;
  prompt_text_token_price?: number; // units = $0.0001 per 1M tokens → divide by 10_000
  cached_prompt_text_token_price?: number;
  prompt_image_token_price?: number;
  completion_text_token_price?: number;
  // image-only / video models lack the completion price above and are skipped.
}

const baseCompat = {
  supportsStore: false,
  supportsDeveloperRole: false,
  // xAI OpenAI-compatible chat accepts reasoning_effort for reasoning models.
  // Without this, thinking levels change in the UI but are never sent.
  supportsReasoningEffort: true,
};

// Map pi thinking levels → xAI reasoning_effort values.
// xAI typically accepts: low | medium | high (and sometimes higher).
const xaiThinkingLevelMap = {
  off: null,
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "high",
  max: "high",
} as const;

function priceToCostPerMillion(price: number | undefined | null): number {
  // xAI prices: 12500 → $1.25/M → divide by 10_000.
  if (typeof price !== "number" || price <= 0) return 0;
  return Number((price / 10_000).toFixed(4));
}

function isReasoningModel(id: string): boolean {
  if (id.includes("non-reasoning")) return false;
  if (id.includes("reasoning")) return true;
  // grok-build, grok-4.5, grok-4.3, multi-agent, and Composer default to reasoning on.
  return (
    id.includes("grok-build") ||
    id.includes("grok-4.5") ||
    id.includes("grok-4.3") ||
    id.includes("grok-composer") ||
    id.includes("multi-agent")
  );
}

function supportsImage(m: XaiModel): boolean {
  return typeof m.prompt_image_token_price === "number" && m.prompt_image_token_price > 0;
}

// Build a pi ProviderModelConfig from an xAI /v1/models row.
function buildModelFromApi(m: XaiModel): ProviderModelConfig {
  const id = m.id;
  const context = m.context_length ?? 128_000;
  const reasoning = isReasoningModel(id);
  const isBuildOrComposer = id.includes("grok-build") || id.includes("grok-composer");
  // Output cap. xAI's /v1/models doesn't expose max output tokens; grok-build
  // and composer models are high-output (256k), chat models default 30k.
  const maxTokens = isBuildOrComposer ? Math.min(context, 256_000) : 30_000;
  const input: ("text" | "image")[] = supportsImage(m) ? ["text", "image"] : ["text"];

  return {
    id,
    name: id,
    reasoning,
    input,
    cost: {
      input: priceToCostPerMillion(m.prompt_text_token_price),
      output: priceToCostPerMillion(m.completion_text_token_price),
      cacheRead: priceToCostPerMillion(m.cached_prompt_text_token_price),
      cacheWrite: 0,
    },
    contextWindow: context,
    maxTokens,
    thinkingLevelMap: reasoning ? { ...xaiThinkingLevelMap } : undefined,
    compat: { ...baseCompat },
  };
}

/** Read the stored xai-subscription access token from pi's auth file. */
function readAccessToken(): string | undefined {
  try {
    const raw = fs.readFileSync(AUTH_FILE, "utf8");
    const auth = JSON.parse(raw) as Record<string, { access?: string }>;
    return auth?.["xai-subscription"]?.access;
  } catch {
    return undefined;
  }
}

async function fetchXaiModels(): Promise<ProviderModelConfig[] | undefined> {
  const token = readAccessToken();
  if (!token) return undefined;
  try {
    const res = await fetch(XAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await throwIfNotOk(res, "model list fetch");
    const payload = (await res.json()) as { data?: XaiModel[] } | XaiModel[];
    const arr = Array.isArray(payload) ? payload : payload.data ?? [];
    return arr
      // Keep only chat/completion models (skip grok-imagine-* image/videogens).
      .filter((m) => m.id && typeof m.completion_text_token_price === "number")
      .map(buildModelFromApi);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Fixed extras: defined in opencode.jsonc but NOT returned by /v1/models.
// ---------------------------------------------------------------------------

// Fixed models always registered. Composer is not listed by /v1/models.
const fixedModels: ProviderModelConfig[] = [
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 500_000,
    maxTokens: 30_000,
    thinkingLevelMap: { ...xaiThinkingLevelMap },
    compat: { ...baseCompat },
  },
  {
    id: "grok-composer-2.5-fast",
    name: "Composer 2.5 Fast",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 },
    contextWindow: 500_000,
    maxTokens: 256_000,
    thinkingLevelMap: { ...xaiThinkingLevelMap },
    compat: { ...baseCompat },
  },
];

// ---------------------------------------------------------------------------
// Register (async factory: live model list before startup finishes)
// ---------------------------------------------------------------------------

export default async function (pi: ExtensionAPI) {
  // Start from the hard-capped fixed list, then overlay live metadata
  // (context/cost) for allowed IDs when /v1/models is reachable.
  const byId = new Map(fixedModels.map((m) => [m.id, m]));
  const live = await fetchXaiModels();
  if (live) {
    for (const m of live) {
      if (!ALLOWED_XAI_MODEL_IDS.has(m.id)) continue;
      byId.set(m.id, m);
    }
  }
  // Preserve fixed order: grok-4.5, then composer.
  const models = [...ALLOWED_XAI_MODEL_IDS]
    .map((id) => byId.get(id))
    .filter((m): m is ProviderModelConfig => !!m);

  pi.registerProvider("xai-subscription", {
    name: "xAI (Subscription)",
    baseUrl: HEADROOM_PROXY_BASE_URL,
    api: "openai-completions",
    headers: {
      "x-headroom-base-url": XAI_UPSTREAM_BASE_URL,
    },
    authHeader: true, // send Authorization: Bearer <access token>
    models,
    oauth: {
      name: "xAI (Subscription)",
      login,
      refreshToken,
      getApiKey: (credentials: OAuthCredentials) => credentials.access,
    },
  });
}