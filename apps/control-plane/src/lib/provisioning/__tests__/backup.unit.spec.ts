import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  BACKUPS_KEPT,
  DEV_PG_EXEC,
  PASS_DIR_PREFIX,
  postgresEnv,
  readNewestManifest,
  runBackup,
  sweepStalePassDirs,
} from "../local/backup"
import type { BackupPlan } from "../local/backup"
import { repoRoot } from "../local/layout"
import { ProvisioningError } from "../provisioner"

const RECIPIENT = "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"
const DATABASE = "qt_tenant_atolye_bicak"

let dir: string
let bin: string
const path = process.env["PATH"]

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qt-backup-"))
  bin = join(dir, "bin")
  await mkdir(bin)
})
afterEach(async () => {
  process.env["PATH"] = path
  await rm(dir, { recursive: true, force: true })
})

async function tool(name: string, body: string): Promise<string> {
  const file = join(bin, name)
  await writeFile(file, `#!/bin/sh\n${body}\n`)
  await chmod(file, 0o755)
  return file
}

/**
 * Stand-ins for `age` (copies what it reads to `--output`) and Postgres
 * (as `PG_EXEC`: a dump's bytes, a server version, one table's count), so
 * the platform's real `infra/backup/backup.sh` runs end to end.
 */
async function stubs(): Promise<string> {
  await tool(
    "age",
    `out=""; while [ $# -gt 0 ]; do [ "$1" = "--output" ] && out="$2"; shift; done; cat > "$out"`
  )
  return await tool(
    "pg",
    `case "$1" in
  pg_dump) printf 'PGDMP-not-a-real-dump' ;;
  psql) case "$*" in *server_version*) echo 16.15 ;; *) echo '{"product": 3}' ;; esac ;;
esac`
  )
}

const planOf = (over: Partial<BackupPlan> = {}): BackupPlan => ({
  script: join(repoRoot(), "infra", "backup", "backup.sh"),
  database: DATABASE,
  outDir: join(dir, "backups", "atolye-bicak"),
  recipientsFile: join(dir, "backups", "recipients.txt"),
  recipients: [RECIPIENT],
  filesDir: null,
  adminUrl: "postgres://postgres:sifre@localhost:55432/postgres",
  pgExec: null,
  logFile: join(dir, "logs", "backup.log"),
  ...over,
})

const codeOf = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work
  } catch (error) {
    return error instanceof ProvisioningError ? error.code : "other"
  }
  return "none"
}

describe("a local shop's backup (audit 3.2)", () => {
  it("runs infra/backup/backup.sh and reads its manifest's summary", async () => {
    const pg = await stubs()
    process.env["PATH"] = `${bin}:${path ?? ""}`
    const files = join(dir, "static")
    await mkdir(files)
    await writeFile(join(files, "urun.jpg"), "jpeg")
    const plan = planOf({ pgExec: pg, filesDir: files })
    const summary = await runBackup(plan)
    expect(summary.files).toBe(true)
    expect(summary.seconds).toBeGreaterThanOrEqual(0)
    expect(summary.manifest).toMatch(/^qt_tenant_atolye_bicak-\d{8}T\d{6}Z\.manifest\.json$/)
    expect(summary.taken_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(summary.dump_sha256).toMatch(/^[0-9a-f]{64}$/)
    const written = await readdir(plan.outDir)
    expect(written.sort()).toEqual(
      [".dump.age", ".files.tar.age", ".manifest.json"].map((end) =>
        summary.manifest.replace(".manifest.json", end)
      )
    )
    const sizes = await Promise.all(
      written
        .filter((name) => name.endsWith(".age"))
        .map(async (name) => {
          return (await stat(join(plan.outDir, name))).size
        })
    )
    expect(summary.bytes).toBe(sizes.reduce((sum, n) => sum + n, 0))
    // Public keys only, private files
    expect(await readFile(plan.recipientsFile, "utf8")).toBe(`${RECIPIENT}\n`)
    expect((await stat(plan.recipientsFile)).mode & 0o077).toBe(0)
    expect((await stat(plan.outDir)).mode & 0o077).toBe(0)
  })

  it("says what is missing: age, recipients, the script; a failure leaves no files", async () => {
    process.env["PATH"] = `${bin}:/usr/bin:/bin`
    const pg = await stubs()
    expect(await codeOf(runBackup(planOf({ pgExec: pg, recipients: [] })))).toBe(
      "provisioning.backup_no_recipients"
    )
    expect(await codeOf(runBackup(planOf({ pgExec: pg, script: join(dir, "yok.sh") })))).toBe(
      "provisioning.backup_tool_missing"
    )
    await rm(join(bin, "age"))
    expect(await codeOf(runBackup(planOf({ pgExec: pg })))).toBe("provisioning.backup_age_missing")

    await stubs()
    await tool("pg", "exit 3")
    const plan = planOf({ pgExec: join(bin, "pg") })
    expect(await codeOf(runBackup(plan))).toBe("provisioning.backup_failed")
    expect(await readdir(plan.outDir).catch(() => [])).toEqual([])
  })

  it("reaches Postgres by PG_EXEC, this machine's tools, else the dev container", async () => {
    process.env["PATH"] = bin
    const pass = join(dir, "pass", ".pgpass")
    const admin = planOf().adminUrl
    expect(await postgresEnv({ adminUrl: admin, pgExec: "docker exec -i x" }, pass)).toEqual({
      PG_EXEC: "docker exec -i x",
    })
    expect(await codeOf(postgresEnv({ adminUrl: admin, pgExec: null }, pass))).toBe(
      "provisioning.backup_pg_dump_missing"
    )
    await tool("docker", "exit 0")
    expect(await postgresEnv({ adminUrl: admin, pgExec: null }, pass)).toEqual({
      PG_EXEC: DEV_PG_EXEC,
    })
    // Review L5: the dev container only for the dev compose's port
    expect(
      await codeOf(
        postgresEnv(
          { adminUrl: "postgres://postgres:x@localhost:5432/postgres", pgExec: null },
          pass
        )
      )
    ).toBe("provisioning.backup_pg_dump_missing")
    await tool("pg_dump", "exit 0")
    await tool("psql", "exit 0")
    // Review L4: the password in a 0600 .pgpass, never an argument or an environment value
    const env = await postgresEnv(
      { adminUrl: "postgres://postgres:s%3Ai%5Cre@localhost:55432/postgres", pgExec: null },
      pass
    )
    expect(env).toEqual({
      PGHOST: "localhost",
      PGPORT: "55432",
      PGUSER: "postgres",
      PGPASSFILE: pass,
    })
    expect(JSON.stringify(env)).not.toContain("s:i")
    expect(await readFile(pass, "utf8")).toBe("localhost:55432:*:postgres:s\\:i\\\\re\n")
    expect((await stat(pass)).mode & 0o077).toBe(0)
  })

  it("keeps the password file in a run's own temporary folder and removes it", async () => {
    await stubs()
    process.env["PATH"] = `${bin}:${path ?? ""}`
    await tool("pg_dump", "exit 0")
    // psql writes where PGPASSFILE points, so the test sees the folder it was in
    await tool(
      "psql",
      `cp "$PGPASSFILE" "${dir}/seen-pass" ; echo "$PGPASSFILE" > "${dir}/seen-path"; exit 3`
    )
    const before = new Set(await readdir(tmpdir()))
    expect(await codeOf(runBackup(planOf()))).toBe("provisioning.backup_failed")
    const used = (await readFile(join(dir, "seen-path"), "utf8")).trim()
    expect(used.startsWith(join(tmpdir(), PASS_DIR_PREFIX))).toBe(true)
    expect(used.startsWith(join(dir, "backups"))).toBe(false)
    const after = (await readdir(tmpdir())).filter(
      (name) => name.startsWith(PASS_DIR_PREFIX) && !before.has(name)
    )
    expect(after).toEqual([])
    expect(await readdir(join(dir, "backups"))).not.toContain(".pgpass")
  })

  it("sweeps only stale password folders", async () => {
    const root = join(dir, "tmp")
    await mkdir(join(root, `${PASS_DIR_PREFIX}old`), { recursive: true })
    await mkdir(join(root, `${PASS_DIR_PREFIX}new`))
    await mkdir(join(root, "other-old"))
    const old = new Date(Date.now() - 3 * 3600_000)
    await utimes(join(root, `${PASS_DIR_PREFIX}old`), old, old)
    await utimes(join(root, "other-old"), old, old)
    await sweepStalePassDirs(root)
    expect((await readdir(root)).sort()).toEqual(["other-old", `${PASS_DIR_PREFIX}new`])
  })

  it("keeps the last backups, drops a crash's .part files, needs room, runs one at a time", async () => {
    const pg = await stubs()
    process.env["PATH"] = `${bin}:${path ?? ""}`
    const plan = planOf({ pgExec: pg })
    await mkdir(plan.outDir, { recursive: true })
    // Eight older backups and a crash's leftover
    for (let n = 0; n < BACKUPS_KEPT + 1; n++) {
      const base = `${DATABASE}-2026010${String(n)}T000000Z`
      await writeFile(join(plan.outDir, `${base}.dump.age`), "x")
      await writeFile(join(plan.outDir, `${base}.manifest.json`), "{}")
    }
    await writeFile(join(plan.outDir, `${DATABASE}-20260109T000000Z.dump.age.part`), "x")
    const summary = await runBackup(plan)
    const left = await readdir(plan.outDir)
    expect(left.filter((name) => name.endsWith(".manifest.json"))).toHaveLength(BACKUPS_KEPT)
    expect(left).toContain(summary.manifest)
    expect(left.some((name) => name.endsWith(".part"))).toBe(false)
    expect(left).not.toContain(`${DATABASE}-20260100T000000Z.dump.age`)

    expect(await codeOf(runBackup({ ...plan, minFreeBytes: Number.MAX_SAFE_INTEGER }))).toBe(
      "provisioning.backup_disk_full"
    )
    // Another live process holds the lock; one left by a gone process is taken over
    const lock = join(dirname(plan.recipientsFile), ".lock")
    await writeFile(lock, String(process.ppid))
    expect(await codeOf(runBackup(plan))).toBe("provisioning.backup_busy")
    await writeFile(lock, "999999999")
    expect((await runBackup(plan)).files).toBe(false)
    expect(await readdir(dirname(lock))).not.toContain(".lock")
  })

  it("says a backup that ran past coreutils' timeout timed out", async () => {
    const pg = await stubs()
    await tool("timeout", "exit 124")
    process.env["PATH"] = `${bin}:${path ?? ""}`
    expect(await codeOf(runBackup(planOf({ pgExec: pg })))).toBe("provisioning.backup_timeout")
  })

  it("reads only this database's manifest written since the run began", async () => {
    const out = join(dir, "out")
    await mkdir(out)
    const manifest = (database: string) =>
      JSON.stringify({
        database,
        taken_at: "2026-11-28T10:00:00Z",
        seconds: 2,
        postgres: "16.15",
        dump: { file: "a.dump.age", sha256: "a".repeat(64), bytes: 100 },
        files: null,
        rows: { product: 3 },
      })
    await writeFile(join(out, "qt_tenant_baska-20261128T100000Z.manifest.json"), manifest(DATABASE))
    expect(await codeOf(readNewestManifest(out, DATABASE, Date.now()))).toBe(
      "provisioning.backup_no_manifest"
    )
    await writeFile(join(out, `${DATABASE}-20261128T100000Z.manifest.json`), manifest("baska"))
    expect(await codeOf(readNewestManifest(out, DATABASE, Date.now()))).toBe(
      "provisioning.backup_no_manifest"
    )
    await writeFile(join(out, `${DATABASE}-20261128T100001Z.manifest.json`), manifest(DATABASE))
    expect(await readNewestManifest(out, DATABASE, Date.now())).toEqual({
      manifest: `${DATABASE}-20261128T100001Z.manifest.json`,
      taken_at: "2026-11-28T10:00:00Z",
      seconds: 2,
      bytes: 100,
      dump_sha256: "a".repeat(64),
      files: false,
    })
  })
})
