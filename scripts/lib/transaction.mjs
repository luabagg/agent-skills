import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, open, readdir, readFile, rename, rm, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

let active;

export async function beginTransaction(targets = []) {
  const records = [];
  for (const filePath of targets) {
    try {
      const stat = await lstat(filePath);
      if (stat.isSymbolicLink()) throw new Error(`Refusing to overwrite unmanaged symlink: ${filePath}`);
      records.push({ path: filePath, existed: true, content: await readFile(filePath), mode: stat.mode & 0o777 });
    } catch (error) {
      if (error.code === "ENOENT") records.push({ path: filePath, existed: false });
      else throw error;
    }
  }
  active = { records, writes: [] };
  return active;
}

function ensurePath(filePath) {
  if (!active) throw new Error("No active transaction");
  const record = active.records.find((item) => item.path === filePath);
  if (!record) throw new Error(`Target was not declared in transaction: ${filePath}`);
  return record;
}

export async function atomicWrite(filePath, content, mode = 0o600) {
  const record = ensurePath(filePath);
  const parent = dirname(filePath);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  let tempPath;
  try {
    try {
      const stat = await lstat(filePath);
      if (stat.isSymbolicLink()) throw new Error(`Refusing to overwrite unmanaged symlink: ${filePath}`);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    tempPath = join(parent, `.${basename(filePath)}.tmp-${process.pid}-${randomUUID()}`);
    const handle = await open(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, mode);
    try { await handle.writeFile(content, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await chmod(tempPath, mode);
    await rename(tempPath, filePath);
    active.writes.push(filePath);
    return { path: filePath, changed: true };
  } catch (error) {
    if (tempPath) await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

export async function rollback(transaction = active) {
  if (!transaction) return { ok: true, restored: [] };
  const restored = [];
  for (const filePath of [...transaction.writes].reverse()) {
    const record = transaction.records.find((item) => item.path === filePath);
    if (!record) continue;
    if (record.existed) {
      await atomicRestore(record.path, record.content, record.mode);
    } else {
      await unlink(record.path).catch((error) => { if (error.code !== "ENOENT") throw error; });
    }
    restored.push(filePath);
  }
  if (active === transaction) active = undefined;
  return { ok: true, restored };
}

async function atomicRestore(filePath, content, mode) {
  const parent = dirname(filePath);
  const tempPath = join(parent, `.${basename(filePath)}.rollback-${process.pid}-${randomUUID()}`);
  const handle = await open(tempPath, "w", mode ?? 0o600);
  try { await handle.writeFile(content); await handle.sync(); }
  finally { await handle.close(); }
  try { await chmod(tempPath, mode ?? 0o600); await rename(tempPath, filePath); }
  catch (error) { await rm(tempPath, { force: true }); throw error; }
}

export async function pruneBackups(filePath, limit = 5) {
  const names = (await readdir(dirname(filePath))).filter((name) => name.startsWith(`${basename(filePath)}.bak-`)).sort();
  for (const name of names.slice(0, Math.max(0, names.length - limit))) await rm(join(dirname(filePath), name), { force: true });
}
