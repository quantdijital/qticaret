import { execFile, spawn } from "node:child_process"
import { rm } from "node:fs/promises"
import { connect } from "node:net"
import { join } from "node:path"
import { promisify } from "node:util"
import { ProvisioningError } from "../provisioner"
import type { ShopLayout } from "./layout"
import { openLog, readPrivateFile, writePrivateFile } from "./private-files"

/**
 * A local shop's backend process (adr/0061 §6.3, Ek C10), and its panel
 * (Ek 2026-11-28, Karar 8): each started
 * detached in its own process group with a pid file, so it outlives the
 * control plane; stopped only after the pid's command line is read and is
 * this shop's (`medusa start` of this backend on this shop's port). A pid
 * file pointing at anything else is never acted on. The pid file and the
 * log are private files (review L5); the log is capped (review L8).
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

/**
 * A process this provisioner starts for a shop: its backend, and on a
 * developer's machine its panel (adr/0061 Ek 2026-11-28, Karar 8). Its own
 * pid file and log; its argv is what its pid's command line must end with,
 * the port included, so a pid file never stands for another shop's process.
 */
export interface ShopProcess {
  pidFile: string
  logFile: string
  cwd: string
  args: string[]
  port: number
}

export const backendProcess = (layout: ShopLayout, port: number): ShopProcess => ({
  pidFile: layout.pidFile,
  logFile: join(layout.logDir, "backend.log"),
  cwd: layout.serverDir,
  args: startArgs(layout, port),
  port,
})

/** The shop's panel on this machine: its backend's port + 1000 (Ek C10 I1). */
export const LOCAL_PANEL_OFFSET = 1000

/** The argv a shop's panel runs with (Vite's dev server, its port fixed). */
export const panelArgs = (layout: ShopLayout, panelPort: number): string[] => [
  layout.panelVite,
  "--strictPort",
  "--port",
  String(panelPort),
]

export const panelProcess = (layout: ShopLayout, port: number): ShopProcess => {
  const panelPort = port + LOCAL_PANEL_OFFSET
  return {
    pidFile: layout.panelPidFile,
    logFile: join(layout.logDir, "panel.log"),
    cwd: layout.panelDir,
    args: panelArgs(layout, panelPort),
    port: panelPort,
  }
}

/**
 * The panel's environment: where its backend is and which port it takes,
 * nothing of the shop's secrets (the panel holds none; it proxies to the
 * backend, adr/0022).
 */
export const panelEnv = (port: number, base: NodeJS.ProcessEnv = process.env) => ({
  PATH: base["PATH"] ?? "",
  ...(base["HOME"] ? { HOME: base["HOME"] } : {}),
  NODE_ENV: "development",
  PANEL_PORT: String(port + LOCAL_PANEL_OFFSET),
  PANEL_BACKEND_URL: `http://localhost:${String(port)}`,
})

async function pidIn(pidFile: string): Promise<number | null> {
  try {
    const pid = Number(((await readPrivateFile(pidFile)) ?? "").trim())
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

/** The process's pid when it is running and is the one this provisioner started. */
export async function ownedProcessPid(proc: ShopProcess): Promise<number | null> {
  const pid = await pidIn(proc.pidFile)
  if (pid === null) {
    return null
  }
  const line = await commandLineOf(pid)
  return line?.endsWith(proc.args.join(" ")) ? pid : null
}

/** The shop's backend pid when it is running and is the one this provisioner started. */
export const ownedPid = (layout: ShopLayout, port: number): Promise<number | null> =>
  ownedProcessPid(backendProcess(layout, port))

/** A signal to the process group `pid` leads; false when no member is left. */
function signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
  try {
    process.kill(-pid, signal)
    return true
  } catch {
    return false
  }
}

/** Started detached on its port, its output to its own log (0600), its pid kept. */
export async function startProcess(
  proc: ShopProcess,
  env: Record<string, string>
): Promise<number> {
  if (!(await isPortFree(proc.port))) {
    throw new ProvisioningError("provisioning.port_in_use")
  }
  const log = await openLog(proc.logFile)
  let pid: number | undefined
  try {
    const child = spawn(process.execPath, proc.args, {
      cwd: proc.cwd,
      env,
      detached: true,
      shell: false,
      stdio: ["ignore", log.fd, log.fd],
    })
    pid = child.pid
    child.unref()
  } finally {
    await log.close()
  }
  if (pid === undefined) {
    throw new ProvisioningError("provisioning.start_failed")
  }
  try {
    await writePrivateFile(proc.pidFile, `${String(pid)}\n`)
  } catch (error) {
    // No pid file, no way to stop it later: it does not stay up (review L6)
    signalGroup(pid, "SIGKILL")
    throw error
  }
  return pid
}

export const startShop = (layout: ShopLayout, port: number, env: Record<string, string>) =>
  startProcess(backendProcess(layout, port), env)

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Ends the process group: SIGTERM, then SIGKILL to the group if any
 * member is left after the wait (review L6). Only a verified pid.
 */
export async function stopProcess(proc: ShopProcess): Promise<boolean> {
  const pid = await ownedProcessPid(proc)
  if (pid === null) {
    // Gone already, or the pid is not this shop's: nothing of ours to stop. A
    // pid file of a process that is gone is dropped; one naming another process is left
    const noted = await pidIn(proc.pidFile)
    if (noted !== null && !signalGroup(noted, 0) && (await commandLineOf(noted)) === null) {
      await rm(proc.pidFile, { force: true })
    }
    return false
  }
  // The group the detached start made: its leader is the verified pid
  signalGroup(pid, "SIGTERM")
  const until = Date.now() + STOP_WAIT_MS
  while (signalGroup(pid, 0) && Date.now() < until) {
    await pause(250)
  }
  if (signalGroup(pid, 0)) {
    signalGroup(pid, "SIGKILL")
    await pause(500)
  }
  await rm(proc.pidFile, { force: true })
  return true
}

export const stopShop = (layout: ShopLayout, port: number): Promise<boolean> =>
  stopProcess(backendProcess(layout, port))

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
