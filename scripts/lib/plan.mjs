import { ACTIONS, resolveAction } from "./actions.mjs";

export function validate(request) {
  if (!request || typeof request !== "object") throw new Error("request must be an object");
  if (!request.actionId || !ACTIONS[request.actionId]) throw new Error(`Unknown action ${JSON.stringify(request.actionId)}`);
  if (request.extraArgs !== undefined && (!Array.isArray(request.extraArgs) || request.extraArgs.some((arg) => typeof arg !== "string" || !arg))) {
    throw new Error("extraArgs must be an array of non-empty strings");
  }
  return { ok: true, errors: [], warnings: [] };
}

export function plan(request, context = {}) {
  validate(request);
  const action = resolveAction(request.actionId, request.extraArgs ?? []);
  const changes = typeof context.readDesiredChanges === "function"
    ? context.readDesiredChanges(request, action) ?? [] : [];
  const processes = context.processes ?? [{ executable: action.executable, args: action.args }];
  return {
    ok: true,
    summary: request.summary ?? action.summary ?? request.actionId,
    changes: [...changes],
    processes: processes.map((process) => ({ ...process, args: [...process.args] })),
    warnings: [],
  };
}
