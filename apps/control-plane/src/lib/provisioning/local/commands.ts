import { spawn } from "node:child_process"
import { readTenantResult } from "@qticaret/types/control-plane"
import { ProvisioningError } from "../provisioner"
import type { CommandResult, TenantCommand } from "../provisioner"
import { openLog } from "./private-files"

/**
 * The closed list of shop commands (adr/0061 §3.4, Ek C10) as Medusa CLI
 * arguments: `medusa db:migrate` and `medusa exec` of the backend's own
 * scripts, nothing else. Run with Node directly (an argv array, never a
 * shell), in the shop's folder, with only the shop's environment.
 */

const MINUTE = 60_000

// Long enough for the slowest (the bootstrap fetches the country's address data)
export const COMMAND_TIMEOUT_MS: Readonly<Record<TenantCommand["name"], number>> = {
  migrate: 10 * MINUTE,
  bootstrap: 20 * MINUTE,
  "invite-owner": 2 * MINUTE,
  "apply-pack": 10 * MINUTE,
  "plan-import": 2 * MINUTE,
  // Uploads the look's pictures through the media pipeline
  "apply-preset": 10 * MINUTE,
  "apply-profile": 2 * MINUTE,
}

// The result line comes last; what came before it is the command's log
const CAPTURE_BYTES = 64 * 1024
const KILL_GRACE_MS = 5_000

// As the sector packs' and looks' codes (packages/sector-packs PACK_CODE, PRESET_CODE):
// never a path or an option
const PACK = /^[a-z][a-z0-9-]{1,39}$/
const PRESET = /^[a-z][a-z0-9-]{1,39}$/
// Control and invisible format characters never make an argument
const CLEAN = /^[^\p{Cc}\p{Cf}\u2028\u2029]+$/u
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/

/** The CLI arguments of a command. */
export function argvOf(cmd: TenantCommand): string[] {
  switch (cmd.name) {
    case "migrate":
      // A new database has only new links: safe to sync without asking
      return ["db:migrate", "--execute-safe-links"]
    case "bootstrap":
      if (!CLEAN.test(cmd.store_name) || cmd.store_name.length > 120) {
        throw new ProvisioningError("provisioning.store_name_invalid")
      }
      return ["exec", "./src/scripts/bootstrap-tenant.js", `store-name=${cmd.store_name}`]
    case "invite-owner":
      if (!EMAIL.test(cmd.email)) {
        throw new ProvisioningError("provisioning.owner_email_invalid")
      }
      return ["exec", "./src/scripts/invite-owner.js", `email=${cmd.email}`]
    case "plan-import":
      return ["exec", "./src/scripts/plan-import.js"]
    case "apply-pack":
      if (!PACK.test(cmd.pack)) {
        throw new ProvisioningError("provisioning.sector_pack_unknown")
      }
      return ["exec", "./src/scripts/apply-pack.js", `pack=${cmd.pack}`]
    case "apply-preset":
      if (!PACK.test(cmd.pack)) {
        throw new ProvisioningError("provisioning.sector_pack_unknown")
      }
      if (!PRESET.test(cmd.preset)) {
        throw new ProvisioningError("provisioning.preset_unknown")
      }
      // Never the demo content: a customer's shop gets no sample records
      return [
        "exec",
        "./src/scripts/apply-preset.js",
        `pack=${cmd.pack}`,
        `preset=${cmd.preset}`,
        "demo=false",
      ]
    case "apply-profile":
      return ["exec", "./src/scripts/apply-profile.js"]
  }
}

/** Keeps the last `max` bytes written to it. */
class Tail {
  private chunks: Buffer[] = []
  private size = 0
  constructor(private readonly max: number) {}
  push(chunk: Buffer): void {
    this.chunks.push(chunk)
    this.size += chunk.length
    while (this.size > this.max && this.chunks.length > 1) {
      this.size -= this.chunks.shift()?.length ?? 0
    }
  }
  text(): string {
    return Buffer.concat(this.chunks).toString("utf8").slice(-this.max)
  }
}

export interface RunOptions {
  cli: string
  /**
   * Another program than Medusa's CLI under Node (the backup script, run
   * by bash): then `args` are its whole argument list and `cli` is unused.
   */
  program?: string
  cwd: string
  env: Record<string, string>
  args: string[]
  stdin?: string
  timeoutMs: number
  /** The shop's own log file for the output; null keeps it nowhere (`invite-owner`). */
  logFile: string | null
}

/** A signal to the command's process group (it was spawned detached, its own group). */
function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) {
    return
  }
  try {
    process.kill(-pid, signal)
  } catch {
    // Gone already
  }
}

/**
 * One command: its stdout's tail read for the result line only, its
 * output appended to the shop's capped log (0600) unless `logFile` is
 * null. Spawned in its own process group: at its time limit the whole
 * group gets SIGTERM, then SIGKILL (review L8). The run ends when the
 * process exits, whatever still holds its pipes, and at a hard deadline
 * in any case, so no step can hang on a command.
 */
export async function runCommand(options: RunOptions): Promise<CommandResult> {
  const started = Date.now()
  const log = options.logFile ? await openLog(options.logFile) : null
  // Writes in order, one after the other; a failed write loses that chunk, not the run
  let writing: Promise<unknown> = Promise.resolve()
  const sink = log
    ? {
        write: (chunk: Buffer) => {
          writing = writing.then(() => log.write(chunk)).catch(() => undefined)
        },
      }
    : null
  const tail = new Tail(CAPTURE_BYTES)
  const [program, argv] = options.program
    ? [options.program, options.args]
    : [process.execPath, [options.cli, ...options.args]]
  const child = spawn(program, argv, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  })
  child.stdout.on("data", (chunk: Buffer) => {
    tail.push(chunk)
    sink?.write(chunk)
  })
  child.stderr.on("data", (chunk: Buffer) => sink?.write(chunk))
  child.stdin.on("error", () => undefined)
  child.stdin.end(options.stdin ?? "")
  const state = { timedOut: false }
  const timers: NodeJS.Timeout[] = []
  timers.push(
    setTimeout(() => {
      state.timedOut = true
      signalGroup(child.pid, "SIGTERM")
      timers.push(
        setTimeout(() => {
          signalGroup(child.pid, "SIGKILL")
        }, KILL_GRACE_MS)
      )
    }, options.timeoutMs)
  )
  const exitCode = await new Promise<number | null>((resolve) => {
    child.once("error", () => {
      resolve(null)
    })
    child.once("exit", (code) => {
      resolve(code)
    })
    // Past the limit and the grace: whatever the process does, the step goes on
    timers.push(
      setTimeout(
        () => {
          state.timedOut = true
          resolve(null)
        },
        options.timeoutMs + KILL_GRACE_MS + 5_000
      )
    )
  })
  // The last output a moment to arrive; then the pipes are let go, held or not
  await new Promise((resolve) => setTimeout(resolve, 100))
  for (const timer of timers) {
    clearTimeout(timer)
  }
  child.stdout.destroy()
  child.stderr.destroy()
  if (state.timedOut) {
    signalGroup(child.pid, "SIGKILL")
  }
  if (log) {
    await writing
    await log.close()
  }
  return {
    ok: !state.timedOut && exitCode === 0,
    exit_code: exitCode,
    timed_out: state.timedOut,
    duration_ms: Date.now() - started,
    result: readTenantResult(tail.text()),
  }
}
