import type { ChildProcess, SpawnOptions } from "node:child_process"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import type { Spawner } from "../run-tool"

/** What a stand-in program does when started. */
export interface FakeProgram {
  /** Written to stdout, then the program exits with `code`. */
  stdout?: string | Buffer
  code?: number
  /** Never exits on its own: only a kill ends it. */
  hang?: boolean
  /** Fails to start (`ENOENT`, `EACCES`). */
  startError?: string
}

export interface FakeCall {
  command: string
  args: readonly string[]
  options: SpawnOptions
  kill: jest.Mock
}

/**
 * A spawn that answers as `program(command, args)` says: records every
 * call and its options, and every kill.
 */
export function fakeSpawn(program: (command: string, args: readonly string[]) => FakeProgram) {
  const calls: FakeCall[] = []
  const spawn: Spawner = (command, args, options) => {
    const plan = program(command, args)
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough
      stderr: PassThrough
      kill: jest.Mock
    }
    // A pid no system hands out (past Linux's and macOS's highest): renicing it touches nothing
    Object.assign(child, { pid: 2_000_000_000 + calls.length })
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    let exited = false
    const exit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (exited) {
        return
      }
      exited = true
      child.stdout.end()
      child.stderr.end()
      setImmediate(() => child.emit("close", code, signal))
    }
    child.kill = jest.fn((signal: NodeJS.Signals) => {
      exit(null, signal)
      return true
    })
    calls.push({ command, args, options, kill: child.kill })
    setImmediate(() => {
      if (plan.startError !== undefined) {
        const error = Object.assign(new Error("spawn failed"), { code: plan.startError })
        child.emit("error", error)
        exit(-2, null)
        return
      }
      if (plan.stdout !== undefined) {
        child.stdout.write(plan.stdout)
      }
      if (exited) {
        // Killed while answering
        return
      }
      child.stderr.write("some words that are never logged\n")
      if (!plan.hang) {
        exit(plan.code ?? 0, null)
      }
    })
    return child as unknown as ChildProcess
  }
  return { spawn, calls }
}
