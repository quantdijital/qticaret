/**
 * `pnpm --filter storefront style:diff -- <before> <after> [--tolerance 0.5] [--limit 8] [--full-keys]`
 *
 * Compares two `style:capture` folders and prints what was drawn
 * differently: page, width, state, element (structural key and its text),
 * property, before → after; added and removed elements apart. Exit code 0
 * when every capture is the same, 1 when one differs, 2 on an error.
 */
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { diffCaptures } from "./diff.ts"
import type { CaptureDiff } from "./diff.ts"
import { print, printError } from "./print.ts"
import { formatReport } from "./report.ts"
import type { Capture, Manifest } from "./types.ts"

const USAGE =
  "style:diff -- <before-dir> <after-dir> [--tolerance <px>, default 0.5; 0 for exact] [--limit <n>] [--full-keys]"

interface DiffArgs {
  before: string
  after: string
  tolerance: number
  limit: number
  fullKeys: boolean
}

function parse(argv: string[]): DiffArgs {
  const dirs: string[] = []
  const args: DiffArgs = { before: "", after: "", tolerance: 0.5, limit: 8, fullKeys: false }
  const list = argv.filter((arg) => arg !== "--")
  for (let i = 0; i < list.length; i += 1) {
    const arg = list[i] ?? ""
    if (arg === "--full-keys") {
      args.fullKeys = true
    } else if (arg === "--tolerance" || arg === "--limit") {
      const value = Number(list[i + 1])
      i += 1
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${arg} takes a number\n${USAGE}`)
      }
      if (arg === "--tolerance") {
        args.tolerance = value
      } else {
        args.limit = value
      }
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}\n${USAGE}`)
    } else {
      dirs.push(arg)
    }
  }
  if (dirs.length !== 2) {
    throw new Error(USAGE)
  }
  const cwd = process.env["INIT_CWD"] ?? process.cwd()
  args.before = resolve(cwd, dirs[0] ?? "")
  args.after = resolve(cwd, dirs[1] ?? "")
  return args
}

async function manifestOf(dir: string): Promise<Manifest> {
  const raw = await readFile(resolve(dir, "manifest.json"), "utf8").catch(() => null)
  if (raw === null) {
    throw new Error(`${dir} has no manifest.json: not a style:capture folder`)
  }
  return JSON.parse(raw) as Manifest
}

async function captureOf(dir: string, file: string): Promise<Capture> {
  return JSON.parse(await readFile(resolve(dir, file), "utf8")) as Capture
}

async function main(): Promise<number> {
  const args = parse(process.argv.slice(2))
  const before = await manifestOf(args.before)
  const after = await manifestOf(args.after)
  const afterFiles = new Map(after.captures.map((each) => [each.file, each]))
  const beforeFiles = new Set(before.captures.map((each) => each.file))
  const diffs: CaptureDiff[] = []
  for (const entry of before.captures) {
    const other = afterFiles.get(entry.file)
    if (!other) {
      continue
    }
    const old = await captureOf(args.before, entry.file)
    const now = await captureOf(args.after, entry.file)
    diffs.push(diffCaptures(entry.file, old, now, { tolerance: args.tolerance }))
  }
  print(
    formatReport(
      {
        diffs,
        onlyBefore: before.captures.map((e) => e.file).filter((f) => !afterFiles.has(f)),
        onlyAfter: after.captures.map((e) => e.file).filter((f) => !beforeFiles.has(f)),
        skippedBefore: before.skipped,
        skippedAfter: after.skipped,
      },
      { limit: args.limit, fullKeys: args.fullKeys, tolerance: args.tolerance }
    )
  )
  const different =
    diffs.some((d) => d.added.length + d.removed.length + d.changed.length > 0) ||
    diffs.length !== before.captures.length ||
    diffs.length !== after.captures.length
  return different ? 1 : 0
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    printError(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
)
