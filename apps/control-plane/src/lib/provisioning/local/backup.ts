import { constants, existsSync } from "node:fs"
import { access, mkdtemp, readFile, readdir, rm, stat, statfs } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, dirname, join } from "node:path"
import { z } from "@medusajs/framework/zod"
import { ProvisioningError } from "../provisioner"
import type { BackupSummary } from "../provisioner"
import {
  PASS_DIR_PREFIX,
  manifestsOf,
  pruneOld,
  pruneParts,
  sweepStalePassDirs,
  takeLock,
} from "./backup-housekeeping"
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
// The script's own limit (coreutils `timeout`), inside the run's, and its grace after SIGTERM
const SCRIPT_LIMIT_S = BACKUP_TIMEOUT_MS / 1000 - 120
const SCRIPT_GRACE_S = 30
/** Free space a backup needs at least: twice the shop's last one, never under this. */
export { BACKUPS_KEPT, PASS_DIR_PREFIX, sweepStalePassDirs } from "./backup-housekeeping"
export const MIN_FREE_BYTES = 512 * 1024 * 1024

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
  /** Tests only: the free space a backup needs at least (default `MIN_FREE_BYTES`). */
  minFreeBytes?: number
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

/** The dev compose's Postgres port on this machine (infra/docker/compose.dev.yml). */
export const DEV_PG_PORT = "55432"

/** A `.pgpass` field: `:` and `\\` escaped (libpq). */
const passField = (value: string) => value.replace(/[\\:]/g, (char) => `\\${char}`)

/**
 * How the script reaches Postgres: `CP_LOCAL_PG_EXEC` when set; else this
 * machine's `pg_dump` with the administrative login (the password in a
 * 0600 `.pgpass` beside the backups, `PGPASSFILE`, removed after the run:
 * never an argument or an environment value every child inherits); else
 * the dev container, only when the administrative URL is that container's
 * port (review L5: never another server's database by mistake).
 */
export async function postgresEnv(
  plan: Pick<BackupPlan, "adminUrl" | "pgExec">,
  passFile: string
): Promise<Record<string, string>> {
  if (plan.pgExec) {
    return { PG_EXEC: plan.pgExec }
  }
  const url = new URL(plan.adminUrl)
  if ((await onPath("pg_dump")) && (await onPath("psql"))) {
    const host = url.hostname.replace(/^\[|\]$/g, "")
    const port = url.port || "5432"
    const user = decodeURIComponent(url.username)
    await writePrivateFile(
      passFile,
      `${[host, port, "*", user, decodeURIComponent(url.password)].map(passField).join(":")}\n`
    )
    return { PGHOST: host, PGPORT: port, PGUSER: user, PGPASSFILE: passFile }
  }
  if (url.port === DEV_PG_PORT && (await onPath("docker"))) {
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
    if (
      mtimeMs >= since - 2_000 &&
      (!newest || mtimeMs > newest.at || (mtimeMs === newest.at && name > newest.name))
    ) {
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

/** Room for this backup (review L2): twice the shop's last one, at least `MIN_FREE_BYTES`. */
async function assertRoom(plan: BackupPlan): Promise<void> {
  const [last] = await manifestsOf(plan.outDir, plan.database)
  let lastBytes = 0
  if (last) {
    try {
      const parsed = manifestSchema.parse(
        JSON.parse(await readFile(join(plan.outDir, last), "utf8"))
      )
      lastBytes = parsed.dump.bytes + (parsed.files?.bytes ?? 0)
    } catch {
      lastBytes = 0
    }
  }
  const disk = await statfs(dirname(plan.recipientsFile))
  if (disk.bavail * disk.bsize < Math.max(2 * lastBytes, plan.minFreeBytes ?? MIN_FREE_BYTES)) {
    throw new ProvisioningError("provisioning.backup_disk_full")
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
  const release = await takeLock(join(dirname(plan.recipientsFile), ".lock"))
  try {
    await sweepStalePassDirs()
    await pruneParts(plan.outDir)
    await assertRoom(plan)
    const started = Date.now()
    // Review L1: the password's file in a folder of this run's own (0700), never in the backups'
    const passDir = await mkdtemp(join(tmpdir(), PASS_DIR_PREFIX))
    // Review L3: the script under coreutils' `timeout` too, SIGKILL after its grace
    const limit = await onPath("timeout")
    const script = [
      bash,
      plan.script,
      "--db",
      plan.database,
      "--recipients",
      plan.recipientsFile,
      "--out",
      plan.outDir,
      ...(plan.filesDir ? ["--files", plan.filesDir] : []),
    ]
    let result
    try {
      result = await runCommand({
        cli: "",
        program: limit ?? bash,
        args: limit
          ? [`--kill-after=${String(SCRIPT_GRACE_S)}`, String(SCRIPT_LIMIT_S), ...script]
          : script.slice(1),
        // The backups' folder, made with the recipients file above
        cwd: dirname(plan.recipientsFile),
        env: {
          PATH: process.env["PATH"] ?? "/usr/bin:/bin",
          HOME: process.env["HOME"] ?? plan.outDir,
          ...(await postgresEnv(plan, join(passDir, ".pgpass"))),
        },
        timeoutMs: BACKUP_TIMEOUT_MS,
        logFile: plan.logFile,
      })
    } finally {
      await rm(passDir, { recursive: true, force: true })
    }
    // 124: `timeout`'s limit; 137: its SIGKILL after the grace
    if (result.timed_out || (limit && (result.exit_code === 124 || result.exit_code === 137))) {
      throw new ProvisioningError("provisioning.backup_timeout")
    }
    if (!result.ok) {
      throw new ProvisioningError("provisioning.backup_failed")
    }
    const summary = await readNewestManifest(plan.outDir, plan.database, started)
    await pruneOld(plan.outDir, plan.database)
    return summary
  } finally {
    await release()
  }
}
