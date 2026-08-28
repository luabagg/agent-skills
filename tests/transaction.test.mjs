import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile, chmod } from "node:fs/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { atomicWrite, beginTransaction, pruneBackups, rollback } from "../scripts/lib/transaction.mjs";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "agent-skills-tx-"));
  const target = join(dir, "config.json");
  await writeFile(target, "old-first\n");
  return { dir, target };
}

test("atomicWrite replaces bytes and rollback restores them", async () => {
  const { target } = await fixture();
  const tx = await beginTransaction([target]);
  await atomicWrite(target, "new-first\n");
  await rollback(tx);
  assert.equal(await readFile(target, "utf8"), "old-first\n");
});

test("atomic writes use restrictive mode and destination-local temporary files", async () => {
  const { dir, target } = await fixture();
  const tx = await beginTransaction([target]);
  await atomicWrite(target, "secret\n", 0o600);
  assert.equal(statSync(target).mode & 0o777, 0o600);
  assert.equal((await readdir(dir)).some((name) => name.includes(".tmp-")), false);
  await rollback(tx);
});

test("unmanaged symlinks are refused", async () => {
  const { dir, target } = await fixture();
  const link = join(dir, "link");
  await symlink(target, link);
  await assert.rejects(() => beginTransaction([link]), /unmanaged symlink/);
});

test("backup retention keeps five backups", async () => {
  const { dir, target } = await fixture();
  for (let index = 0; index < 7; index += 1) await writeFile(`${target}.bak-${index}`, String(index));
  await pruneBackups(target, 5);
  assert.equal((await readdir(dir)).filter((name) => name.startsWith("config.json.bak-")).length, 5);
});
