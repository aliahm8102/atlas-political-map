import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pgBin = process.env.ATLAS_PG_BIN || (process.platform === "win32" ? "C:/Program Files/PostgreSQL/16/bin" : "/usr/lib/postgresql/16/bin");
const binary = name => path.join(pgBin, name + (process.platform === "win32" ? ".exe" : ""));
if (!existsSync(binary("initdb"))) throw new Error("PostgreSQL 16 is required; set ATLAS_PG_BIN to its bin directory.");
const directory = mkdtempSync(path.join(os.tmpdir(), "atlas-db-test-"));
const data = path.join(directory, "data");
const run = (name, args) => execFileSync(binary(name), args, { cwd: root, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const control = args => execFileSync(binary("pg_ctl"), args, { cwd: root, windowsHide: true, stdio: "ignore" });
let started = false;
try {
  run("initdb", ["-D", data, "-A", "trust", "--no-locale", "--encoding=UTF8", "-U", "atlas_test"]);
  control(["-D", data, "-l", path.join(directory, "server.log"), "-o", "-h 127.0.0.1 -p 55439", "-w", "start"]);
  started = true;
  const accountEmailFix = "supabase/migrations/20261030000200_fix_account_email_return_type.sql";
  // Apply the repair twice to verify it can safely be rerun on existing installs.
  const files = ["supabase/tests/bootstrap.sql", "supabase/migrations/20261017000100_atlas_schema.sql", "supabase/migrations/20261017000200_import_wim_data.sql", "supabase/migrations/20261020000100_remove_saved_views.sql", "supabase/migrations/20261030000100_administration.sql", accountEmailFix, accountEmailFix, "supabase/tests/isolation.sql", "supabase/tests/administration.sql"];
  const output = run("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "55439", "-U", "atlas_test", "-d", "postgres", ...files.flatMap(file => ["-f", file])]);
  console.log(output);
  const asyncExec = promisify(execFile);
  const base = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "55439", "-U", "atlas_test", "-d", "postgres"];
  const review = "begin; set role authenticated; select set_config('request.jwt.claim.sub', '11111111-1111-4111-a111-111111111111', true); select public.review_atlas_character((select id from public.character_submissions where local_id = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'), 'approved', 'Concurrent review'); select pg_sleep(0.2); commit;";
  const concurrent = await Promise.allSettled([1, 2].map(() => asyncExec(binary("psql"), [...base, "-c", review], { cwd: root, encoding: "utf8", windowsHide: true })));
  assert.equal(concurrent.filter(item => item.status === "fulfilled").length, 1, "Only one concurrent approval can commit");
  assert.ok(concurrent.some(item => item.status === "rejected" && item.reason.stderr.includes("no longer pending")));
  const count = run("psql", [...base, "-t", "-A", "-c", "select count(*) from public.people where name = 'Corrected submission'"]);
  assert.equal(count.trim(), "1");
  console.log("PASS: concurrent approvals create exactly one shared character.");
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) control(["-D", data, "-m", "immediate", "-w", "stop"]);
  // Only remove the temporary cluster created by this invocation.
  if (path.dirname(path.resolve(directory)) === path.resolve(os.tmpdir()) && path.basename(directory).startsWith("atlas-db-test-")) rmSync(directory, { recursive: true, force: true });
}
