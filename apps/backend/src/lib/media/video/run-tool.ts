import { spawn as nodeSpawn } from "node:child_process"
import type { ChildProcess, SpawnOptions } from "node:child_process"

/**
 * ffprobe and ffmpeg, run as programs of their own (adr/0069 §4): an
 * argument list and no shell, stdin closed, a bare environment, a hard
 * time limit (then SIGKILL) and a cap on what is read back from them.
 * Their work happens in another process; this side only counts bytes.
 */

/** Node's `spawn`, or a stand-in for tests. */
export type Spawner = (
  command: string,
  args: readonly string[],
  options: SpawnOptions
) => ChildProcess

export interface ToolRun {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: Buffer
  /** Killed for running past its time. */
  timedOut: boolean
  /** Killed for answering more than it may. */
  overflow: boolean
  /** Killed (or never started) because the caller's signal fired: the transcoding job's whole time. */
  aborted: boolean
}

export interface ToolOptions {
  timeoutMs: number
  maxOutputBytes: number
  spawn?: Spawner
  /** Fired, the program is killed (SIGKILL); fired already, it never starts. */
  signal?: AbortSignal
  /** Called once with the started program's pid (the transcoding job lowers its priority). */
  onSpawn?: (pid: number) => void
}

/** The program could not start at all (not installed, not executable). */
export class ToolStartError extends Error {
  override readonly name = "ToolStartError"
  readonly code: string | undefined

  constructor(code: string | undefined) {
    super(`tool did not start: ${code ?? "unknown"}`)
    this.code = code
  }
}

// What the programs see: where to find their libraries, and no locale surprises
const toolEnv = (): NodeJS.ProcessEnv => ({ PATH: process.env["PATH"] ?? "", LC_ALL: "C" })

const NOT_STARTED: ToolRun = {
  code: null,
  signal: null,
  stdout: Buffer.alloc(0),
  timedOut: false,
  overflow: false,
  aborted: true,
}

export function runTool(
  command: string,
  args: readonly string[],
  { timeoutMs, maxOutputBytes, spawn = nodeSpawn, signal, onSpawn }: ToolOptions
): Promise<ToolRun> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      resolve({ ...NOT_STARTED, stdout: Buffer.alloc(0) })
      return
    }
    let child: ChildProcess
    try {
      child = spawn(command, args, {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: toolEnv(),
        windowsHide: true,
      })
    } catch (error) {
      reject(new ToolStartError((error as { code?: string } | null)?.code))
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    let timedOut = false
    let overflow = false
    let aborted = false
    let settled = false
    const kill = () => {
      try {
        child.kill("SIGKILL")
      } catch {
        // Already gone
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, timeoutMs)
    timer.unref()
    const onAbort = () => {
      aborted = true
      kill()
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
    if (onSpawn && child.pid !== undefined) {
      onSpawn(child.pid)
    }
    child.stdout?.on("data", (chunk: Buffer) => {
      if (overflow) {
        return
      }
      size += chunk.length
      if (size > maxOutputBytes) {
        overflow = true
        chunks.length = 0
        kill()
        return
      }
      chunks.push(chunk)
    })
    // Read and dropped: a full pipe would stall the program; its words are never logged
    child.stderr?.on("data", () => undefined)
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) {
        return
      }
      settled = true
      finish()
      kill()
      reject(new ToolStartError(error.code))
    })
    child.on("close", (code: number | null, exitSignal: NodeJS.Signals | null) => {
      if (settled) {
        return
      }
      settled = true
      finish()
      resolve({
        code,
        signal: exitSignal,
        stdout: Buffer.concat(chunks),
        timedOut,
        overflow,
        aborted,
      })
    })
  })
}
