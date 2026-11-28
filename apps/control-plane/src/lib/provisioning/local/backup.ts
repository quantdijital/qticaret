import { constants, existsSync } from "node:fs"
import { access, readFile, readdir, stat } from "node:fs/promises"
import { delimiter, dirname, join } from "node:path"
import { z } from "@medusajs/framework/zod"
import { ProvisioningError } from "../provisioner"
import type { BackupSummary } from "../provisioner"
import { runCommand } from "./commands"
import { writePrivateFile } from "./private-files"

/**
 * A local shop's backup (audit 3.2) by the platform's own tool,
 * `infra/backup/backup.sh` (F15.5): the database's `pg_dump` and the
 * shop's uploads, encrypted while read to the age recipients the control
 * plane escrows to (`CP_ESCROW_RECIPIENTS`: production's `recipients.txt`
 * holds the same public keys), and the manifest beside them. Run without
 * a shell (bash with the script and a fixed argument list), with only
 * what the script needs in its environment. Restore stays the runbook's
 * (`docs/runbooks/yedek-ve-geri-yukleme.md`): the key that opens a backup
 * is never on this machine.
 */

/** As the runbook's development line: the dev Postgres's own `pg_dump` (infra/docker/compose.dev.yml). */
export const DEV_PG_EXEC = "docker exec -i -e PGUSER=postgres qticaret-dev-postgres-1"

// A large shop's dump through age: well past any step's usual time
export const BACKUP_TIMEOUT_MS = 60 * 60 * 1000

export interface BackupPlan {
  /** `infra/backup/backup.sh`. */
  script: string
  /** `qt_tenant_<slug>`. */
  database: string
  /** The shop's own backups' folder (0700). */
  outDir: string
  /** The recipients file the script reads (public keys only, 0600). */
  recipientsFile: string
  recipients: readonly string[]
  /** The shop's uploads, when the folder exists. */
  filesDir: string | null
  /** `CP_LOCAL_PG_ADMIN_URL`: the host `pg_dump`'s login, when no `PG_EXEC`. */
  adminUrl: string
  /** `CP_LOCAL_PG_EXEC`, when set. */
  pgExec: string | null
  logFile: string
}

/** A program on `PATH`, looked up without a shell; null when absent. */
export async function onPath(name: string, path: string = process.env["PATH"] ?? "") {
  for (const dir of path.split(delimiter).filter(Boolean)) {
    const candidate = join(dir, name)
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Not here
    }
  }
  return null
}

/**
 * How the script reaches Postgres: `CP_LOCAL_PG_EXEC` when set; else this
 * machine's `pg_dump` with the administrative login in libpq's variables
 * (the child's environment only, never an argument); else the dev
 * container, as the runbook says.
 */
export async function postgresEnv(plan: Pick<BackupPlan, "adminUrl" | "pgExec">) {
  if (plan.pgExec) {
    return { PG_EXEC: plan.pgExec }
  }
  if ((await onPath("pg_dump")) && (await onPath("psql"))) {
    const url = new URL(plan.adminUrl)
    return {
      PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
    }
  }
  if (await onPath("docker")) {
    return { PG_EXEC: DEV_PG_EXEC }
  }
  throw new ProvisioningError("provisioning.backup_pg_dump_missing")
}

const entry = z.object({
  file: z.string().regex(/^[A-Za-z0-9_.-]{1,200}$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().nonnegative(),
})

// What is read of the manifest: the rest (row counts) stays in it
const manifestSchema = z.object({
  database: z.string(),
  taken_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
  seconds: z.number().int().nonnegative(),
  dump: entry,
  files: entry.nullable(),
})

/** The summary of the manifest this run wrote: the newest of the database's since `since`. */
export async function readNewestManifest(
  outDir: string,
  database: string,
  since: number
): Promise<BackupSummary> {
  const names = (await readdir(outDir)).filter(
    (name) => name.startsWith(`${database}-`) && name.endsWith(".manifest.json")
  )
  let newest: { name: string; at: number } | null = null
  for (const name of names) {
    const { mtimeMs } = await stat(join(outDir, name))
    if (mtimeMs >= since - 2_000 && (!newest || mtimeMs > newest.at)) {
      newest = { name, at: mtimeMs }
    }
  }
  if (!newest) {
    throw new ProvisioningError("provisioning.backup_no_manifest")
  }
  const parsed = manifestSchema.safeParse(
    JSON.parse(await readFile(join(outDir, newest.name), "utf8"))
  )
  if (!parsed.success || parsed.data.database !== database) {
    throw new ProvisioningError("provisioning.backup_no_manifest")
  }
  const { taken_at, seconds, dump, files } = parsed.data
  return {
    manifest: newest.name,
    taken_at,
    seconds,
    bytes: dump.bytes + (files?.bytes ?? 0),
    dump_sha256: dump.sha256,
    files: files !== null,
  }
}

/** One backup of a local shop; its failure as a code, never the script's output. */
export async function runBackup(plan: BackupPlan): Promise<BackupSummary> {
  if (!existsSync(plan.script)) {
    throw new ProvisioningError("provisioning.backup_tool_missing")
  }
  if (!(await onPath("age"))) {
    throw new ProvisioningError("provisioning.backup_age_missing")
  }
  const bash = await onPath("bash")
  if (!bash) {
    throw new ProvisioningError("provisioning.backup_tool_missing")
  }
  if (plan.recipients.length === 0) {
    throw new ProvisioningError("provisioning.backup_no_recipients")
  }
  // Public keys only: the script itself refuses a file that holds a secret key
  await writePrivateFile(plan.recipientsFile, `${plan.recipients.join("\n")}\n`)
  const started = Date.now()
  const result = await runCommand({
    cli: "",
    program: bash,
    args: [
      plan.script,
      "--db",
      plan.database,
      "--recipients",
      plan.recipientsFile,
      "--out",
      plan.outDir,
      ...(plan.filesDir ? ["--files", plan.filesDir] : []),
    ],
    // The backups' folder, made with the recipients file above
    cwd: dirname(plan.recipientsFile),
    env: {
      PATH: process.env["PATH"] ?? "/usr/bin:/bin",
      HOME: process.env["HOME"] ?? plan.outDir,
      ...(await postgresEnv(plan)),
    },
    timeoutMs: BACKUP_TIMEOUT_MS,
    logFile: plan.logFile,
  })
  if (!result.ok) {
    throw new ProvisioningError(
      result.timed_out ? "provisioning.backup_timeout" : "provisioning.backup_failed"
    )
  }
  return await readNewestManifest(plan.outDir, plan.database, started)
}
