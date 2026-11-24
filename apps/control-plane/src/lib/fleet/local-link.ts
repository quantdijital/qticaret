import { randomBytes } from "node:crypto"
import { constants } from "node:fs"
import { chmod, lstat, open, readFile, realpath, rename, rm } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { isLocalEnv } from "@qticaret/server-kit"
import { localOnlyProblem } from "../local-only"
import type { Env } from "../env"

/**
 * `cp:link-local` (scripts/link-local.ts): a developer's own shop backend
 * (`apps/backend`, its `.env`) linked to a control plane tenant, so the
 * shop runs managed on this machine. The pure parts and the file's
 * in-place rewrite live here; no value read or written is ever printed.
 */

/** The four variables the shop needs to be managed (apps/backend/src/lib/control-plane/env.ts). */
export const LINK_KEYS = [
  "CONTROL_PLANE_URL",
  "CONTROL_PLANE_PUBLIC_KEYS",
  "TENANT_ID",
  "TENANT_SIGNING_KEY",
] as const
export type LinkKey = (typeof LINK_KEYS)[number]
export type LinkValues = Record<LinkKey, string>

export type LinkChange = "set" | "updated" | "unchanged"

// A line that assigns a variable: `KEY=value`, optionally `export KEY=value`
const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/
// Plain unquoted values only (base64url, URLs, ids): nothing a dotenv reader bends
const SAFE_VALUE = /^[A-Za-z0-9._~:/@%+=,-]+$/

/**
 * Why this control plane may not link a local shop, or null: development
 * or test only, against a database on this machine (lib/local-only.ts).
 */
export function linkLocalProblem(env: Pick<Env, "NODE_ENV" | "DATABASE_URL">): string | null {
  return localOnlyProblem(env)
}

/** The value of a dotenv right-hand side: quotes and a trailing comment dropped. */
function valueOf(raw: string): string {
  const trimmed = raw.trim()
  const quoted = /^(["'])(.*)\1$/.exec(trimmed)
  if (quoted) {
    return quoted[2] ?? ""
  }
  return trimmed.replace(/\s+#.*$/, "")
}

/** The file's assignments (the last one of a key wins, as dotenv's parse). */
export function parseEnvAssignments(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const match = ASSIGNMENT.exec(line)
    if (match?.[1] !== undefined && !line.trimStart().startsWith("#")) {
      env[match[1]] = valueOf(match[2] ?? "")
    }
  }
  return env
}

/**
 * Why the shop's env file may not be linked, or null: a shop file that
 * says it runs outside development and test is refused (an unset
 * `NODE_ENV` is the development server's own).
 */
export function shopEnvProblem(env: Record<string, string>): string | null {
  const nodeEnv = env["NODE_ENV"]
  if (nodeEnv !== undefined && nodeEnv !== "" && !isLocalEnv({ NODE_ENV: nodeEnv })) {
    return "the shop's env file is not a development one (NODE_ENV)"
  }
  return null
}

export interface MergedEnv {
  text: string
  changes: { key: LinkKey; change: LinkChange }[]
}

/**
 * `text` with exactly `values`' keys set: every assignment of one replaced
 * in place (commented lines left alone), a missing one appended; every
 * other line kept byte for byte. Throws, naming the key only, on a value
 * an unquoted env line cannot hold.
 */
export function mergeEnvText(text: string, values: LinkValues): MergedEnv {
  for (const key of LINK_KEYS) {
    if (!SAFE_VALUE.test(values[key])) {
      throw new Error(`cp:link-local: ${key} cannot be written as a plain env value`)
    }
  }
  const newline = text.includes("\r\n") ? "\r\n" : "\n"
  const lines = text === "" ? [] : text.split(/\r?\n/)
  // A final newline leaves one empty element behind: kept aside, put back last
  const trailing = lines.length > 0 && lines[lines.length - 1] === ""
  if (trailing) {
    lines.pop()
  }
  const seen = new Map<LinkKey, LinkChange>()
  const out = lines.map((line) => {
    const match = line.trimStart().startsWith("#") ? null : ASSIGNMENT.exec(line)
    const key = match?.[1] as LinkKey | undefined
    if (key === undefined || !(LINK_KEYS as readonly string[]).includes(key)) {
      return line
    }
    const same = valueOf(match?.[2] ?? "") === values[key]
    const before = seen.get(key)
    seen.set(key, before === "updated" || !same ? "updated" : "unchanged")
    return `${key}=${values[key]}`
  })
  const missing = LINK_KEYS.filter((key) => !seen.has(key))
  for (const key of missing) {
    out.push(`${key}=${values[key]}`)
    seen.set(key, "set")
  }
  const body = out.join(newline)
  return {
    text: body === "" ? "" : `${body}${trailing || missing.length > 0 ? newline : ""}`,
    changes: LINK_KEYS.map((key) => ({ key, change: seen.get(key) ?? "set" })),
  }
}

/**
 * The shop's env file: `raw` (the `env=` argument) resolved against where
 * the command was typed (pnpm's `INIT_CWD`), else the repository's
 * `apps/backend/.env`.
 */
export function shopEnvPath(raw: string | undefined, root: string, typedIn?: string): string {
  if (!raw) {
    return join(root, "apps", "backend", ".env")
  }
  return isAbsolute(raw) ? raw : resolve(typedIn ?? process.cwd(), raw)
}

/** The file's real path (a symlinked `.env` is followed) and its text; refused unless a plain file. */
export async function readShopEnv(path: string): Promise<{ target: string; text: string }> {
  const target = await realpath(path)
  const stats = await lstat(target)
  if (!stats.isFile()) {
    throw new Error("cp:link-local: the shop's env file is not a plain file")
  }
  return { target, text: await readFile(target, "utf8") }
}

/**
 * `text` written over `target` whole: a fresh temporary file beside it,
 * given the target's mode, synced and renamed over it (a link to the
 * target stays a link). A failure removes the temporary file.
 */
export async function writeShopEnv(target: string, text: string): Promise<void> {
  const mode = (await lstat(target)).mode & 0o7777
  const temporary = join(dirname(target), `.link-local.${randomBytes(6).toString("hex")}.tmp`)
  const handle = await open(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600
  )
  try {
    try {
      await handle.writeFile(text, "utf8")
      await handle.sync()
    } finally {
      await handle.close()
    }
    await chmod(temporary, mode)
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}
