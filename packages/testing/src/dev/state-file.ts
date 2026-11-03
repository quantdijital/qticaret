import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

/**
 * Where a local provider server keeps what it has seen between runs
 * (payments, invoices, tokens), so restarting it does not break a refund
 * or a Paraşüt connection. One file per server and port under the OS temp
 * directory; tests pass none and start empty.
 */
export const stateFileFor = (name: string, port: number): string =>
  join(tmpdir(), "qticaret-local-providers", `${name}-${String(port)}.json`)

/** The saved state (the caller names its shape), or null when there is none or it cannot be read. */
export function loadState(file: string | undefined): unknown {
  if (!file) {
    return null
  }
  try {
    return JSON.parse(readFileSync(file, "utf8")) as unknown
  } catch {
    return null
  }
}

/** Writes the state whole, through a temporary file, so a crash never leaves half of it. */
export function saveState(file: string | undefined, state: unknown): void {
  if (!file) {
    return
  }
  mkdirSync(dirname(file), { recursive: true })
  const partial = `${file}.${String(process.pid)}.tmp`
  writeFileSync(partial, JSON.stringify(state))
  renameSync(partial, file)
}
