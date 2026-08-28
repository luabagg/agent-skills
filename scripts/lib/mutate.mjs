export async function applyPlan(plan, { dryRun = false, mutate, runProcess } = {}) {
  if (!plan?.ok) throw new Error("Cannot apply an invalid plan");
  if (dryRun) return { ok: true, changed: false, rollback: null };
  const { beginTransaction, atomicWrite, rollback } = await import("./transaction.mjs");
  const targets = (plan.changes ?? []).map((change) => change.path).filter(Boolean);
  const transaction = await beginTransaction(targets);
  try {
    if (typeof mutate === "function") await mutate(plan.changes ?? [], transaction);
    else for (const change of plan.changes ?? []) await atomicWrite(change.path, change.content, change.mode);
    if (typeof runProcess === "function") for (const process of plan.processes ?? []) await runProcess(process);
    return { ok: true, changed: (plan.changes ?? []).length > 0 || (plan.processes ?? []).length > 0, rollback: null };
  } catch (error) {
    const restored = await rollback(transaction);
    error.rollback = restored;
    throw error;
  }
}
