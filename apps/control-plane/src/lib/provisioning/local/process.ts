import { execFile, spawn } from "node:child_process"
import { constants } from "node:fs"
import { mkdir, open, readFile, rm } from "node:fs/promises"
import { connect } from "node:net"
import { promisify } from "node:util"
import { ProvisioningError } from "../provisioner"
import type { ShopLayout } from "./layout"

/**
 * A local shop's backend process (adr/0061 §6.3, Ek C10): started
 * detached in its own process group with a pid file, so it outlives the
 * control plane; stopped only after the pid's command line is read and is
 * this shop's (`medusa start` of this backend on this shop's port). A pid
 * file pointing at anything else is never acted on.
 */

const run = promisify(execFile)
const STOP_WAIT_MS = 15_000

/** Whether nothing answers on 127.0.0.1:`port`. */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port })
    const done = (free: boolean) => {
      socket.destroy()
      resolve(free)
    }
    socket.setTimeout(1_000, () => {
      done(false)
    })
    socket.once("connect", () => {
      done(false)
    })
    socket.once("error", (error: NodeJS.ErrnoException) => {
      done(error.code === "ECONNREFUSED")
    })
  })
}

/** The argv a shop's backend runs with; also what its pid's command line must show. */
export const startArgs = (layout: ShopLayout, port: number): string[] => [
  layout.cli,
  "start",
  "-p",
  String(port),
]

async function pidOf(layout: ShopLayout): Promise<number | null> {
  try {
    const pid = Number((await readFile(layout.pidFile, "utf8")).trim())
    return Number.isSafeInteger(pid) && pid > 1 ? pid : null
  } catch {
    return null
  }
}

/** The process's command line, or null when it is gone. `ps` without a shell. */
async function commandLineOf(pid: number): Promise<string | null> {
  try {
    // `-ww`: the whole line, however wide
    const { stdout } = await run("ps", ["-ww", "-o", "command=", "-p", String(pid)], {
      timeout: 5_000,
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}

/** The shop's backend pid when it is running and is the one this provisioner started. */
export async function ownedPid(layout: ShopLayout, port: number): Promise<number | null> {
  const pid = await pidOf(layout)
  if (pid === null) {
    return null
  }
  const line = await commandLineOf(pid)
  return line?.endsWith(startArgs(layout, port).join(" ")) ? pid : null
}

/** Started detached on its port, its output to its own log (0600), its pid kept. */
export async function startShop(
  layout: ShopLayout,
  port: number,
  env: Record<string, string>
): Promise<number> {
  if (!(await isPortFree(port))) {
    throw new ProvisioningError("provisioning.port_in_use")
  }
  await mkdir(layout.logDir, { recursive: true, mode: 0o700 })
  const log = await open(
    `${layout.logDir}/backend.log`,
    constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND,
    0o600
  )
  try {
    const child = spawn(process.execPath, startArgs(layout, port), {
      cwd: layout.serverDir,
      env,
      detached: true,
      shell: false,
      stdio: ["ignore", log.fd, log.fd],
    })
    const pid = child.pid
    child.unref()
    if (pid === undefined) {
      throw new ProvisioningError("provisioning.start_failed")
    }
    const file = await open(
      layout.pidFile,
      constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC,
      0o600
    )
    try {
      await file.writeFile(`${String(pid)}\n`)
    } finally {
      await file.close()
    }
    return pid
  } finally {
    await log.close()
  }
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Ends the shop's process group (SIGTERM, SIGKILL after a wait); only a verified pid. */
export async function stopShop(layout: ShopLayout, port: number): Promise<boolean> {
  const pid = await ownedPid(layout, port)
  if (pid === null) {
    // Gone already, or the pid is not this shop's: nothing of ours to stop. A
    // pid file of a process that is gone is dropped; one naming another process is left
    const noted = await pidOf(layout)
    if (noted !== null && !alive(noted)) {
      await rm(layout.pidFile, { force: true })
    }
    return false
  }
  // The group the detached start made: its leader is the verified pid
  const signal = (name: NodeJS.Signals) => {
    try {
      process.kill(-pid, name)
    } catch {
      // Already gone
    }
  }
  signal("SIGTERM")
  const until = Date.now() + STOP_WAIT_MS
  while (alive(pid) && Date.now() < until) {
    await pause(250)
  }
  if (alive(pid)) {
    signal("SIGKILL")
    await pause(500)
  }
  await rm(layout.pidFile, { force: true })
  return true
}

/** `GET /health` on the shop's port: its status and how long it took. */
export async function healthOf(
  port: number
): Promise<{ status: number | null; latency_ms: number | null }> {
  const started = Date.now()
  try {
    const answer = await fetch(`http://127.0.0.1:${String(port)}/health`, {
      redirect: "manual",
      signal: AbortSignal.timeout(3_000),
    })
    await answer.body?.cancel()
    return { status: answer.status, latency_ms: Date.now() - started }
  } catch {
    return { status: null, latency_ms: null }
  }
}
