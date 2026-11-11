import { randomBytes } from "node:crypto"
import { constants } from "node:fs"
import { chmod, lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises"
import { dirname } from "node:path"
import type { RuntimeSecrets } from "../../vault/tenant-secrets"
import { ProvisioningError } from "../provisioner"
import type { ProvisionTarget } from "../provisioner"
import { databaseNameOf } from "./layout"

/**
 * The local shop's secret store (adr/0061 §4.3, §6.3, Ek C10): one env
 * file, mode 0600, in a 0700 folder, written whole through a temporary
 * file. It is the only place a local shop's secrets exist: the control
 * plane never keeps them, and this file's values are never logged.
 */

/** What the shop needs besides its secrets, from the control plane's own settings. */
export interface LocalSettings {
  /** The dev Postgres the shop's database is on (host and port of the admin URL). */
  pg_host: string
  /** The shared Redis; the shop's keys fall under a namespace its database names. */
  redis_url: string | null
  /** Mailpit's send API, when the control plane mails through it. */
  mailpit_url: string | null
  control_plane_url: string
}

// Plain unquoted values only: no space, quote, `#`, `$` or backslash for a dotenv reader to bend
const SAFE_VALUE = /^[A-Za-z0-9._~:/@%+=,\-[\]]*$/
const NAME = /^[A-Z][A-Z0-9_]*$/

const DEV_PORTS = { storefront: "http://localhost:8000" } as const

/** The shop's environment: its secrets, its database, and what makes it managed. */
export function composeEnv(
  t: ProvisionTarget,
  secrets: RuntimeSecrets["values"],
  settings: LocalSettings
): Record<string, string> {
  const name = databaseNameOf(t.slug)
  const own = `http://localhost:${String(t.port)}`
  const env: Record<string, string> = {
    NODE_ENV: "development",
    DATABASE_URL: `postgres://${name}:${secrets.DATABASE_PASSWORD}@${settings.pg_host}/${name}`,
    // The panel's proxy sends the backend's own origin (apps/panel/vite.config.ts)
    STORE_CORS: DEV_PORTS.storefront,
    ADMIN_CORS: own,
    AUTH_CORS: own,
    JWT_SECRET: secrets.JWT_SECRET,
    COOKIE_SECRET: secrets.COOKIE_SECRET,
    PII_ENCRYPTION_KEY: secrets.PII_ENCRYPTION_KEY,
    PII_HASH_KEY: secrets.PII_HASH_KEY,
    CREDENTIALS_ENCRYPTION_KEY: secrets.CREDENTIALS_ENCRYPTION_KEY,
    AUTH_MFA_ENCRYPTION_KEY: secrets.AUTH_MFA_ENCRYPTION_KEY,
    STOREFRONT_IP_SECRET: secrets.STOREFRONT_IP_SECRET,
    // adr/0061 §3.2, Ek C9: managed by this control plane
    CONTROL_PLANE_URL: settings.control_plane_url,
    CONTROL_PLANE_PUBLIC_KEYS: t.public_keys,
    TENANT_ID: t.tenant_id,
    TENANT_SIGNING_KEY: secrets.TENANT_SIGNING_KEY,
    // A developer's sign-ups never reach the outside breach list (backend env.example)
    PASSWORD_BREACH_CHECK: "off",
    MEDUSA_DISABLE_TELEMETRY: "true",
    PORT: String(t.port),
  }
  if (settings.redis_url) {
    env["REDIS_URL"] = settings.redis_url
  }
  if (settings.mailpit_url) {
    Object.assign(env, {
      EMAIL_TRANSPORT: "mailpit",
      MAILPIT_URL: settings.mailpit_url,
      EMAIL_FROM: "bildirim@magaza.test",
    })
  }
  return env
}

/** The file's text; refuses a name or value a plain env line cannot hold as is. */
export function envText(env: Record<string, string>): string {
  const lines = Object.entries(env).map(([key, value]) => {
    if (!NAME.test(key) || !SAFE_VALUE.test(value)) {
      // The name only: a value may be a secret
      throw new ProvisioningError("provisioning.env_value_invalid")
    }
    return `${key}=${value}`
  })
  return [
    "# A local shop's runtime secrets and settings (adr/0061 Ek C10), written by the",
    "# control plane's local provisioner. Never commit, copy or print this file.",
    ...lines,
    "",
  ].join("\n")
}

/** `KEY=value` lines back; comments and blank lines skipped. */
export function parseEnvText(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf("=")
    if (line.startsWith("#") || at < 1) {
      continue
    }
    const key = line.slice(0, at)
    if (NAME.test(key)) {
      env[key] = line.slice(at + 1)
    }
  }
  return env
}

/** Written whole: a temporary 0600 file in the same 0700 folder, renamed over the old one. */
export async function writeEnvFile(path: string, env: Record<string, string>): Promise<void> {
  const text = envText(env)
  const folder = dirname(path)
  await mkdir(folder, { recursive: true, mode: 0o700 })
  await chmod(folder, 0o700)
  const temporary = `${path}.${randomBytes(6).toString("hex")}.tmp`
  const handle = await open(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
    0o600
  )
  try {
    await handle.writeFile(text, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

/**
 * The shop's env, or null when there is none. Refused when anyone but its
 * owner could read or change it, or when it is not a plain file (a link).
 */
export async function readEnvFile(path: string): Promise<Record<string, string> | null> {
  let stats
  try {
    stats = await lstat(path)
  } catch {
    return null
  }
  const uid = process.getuid?.()
  if (!stats.isFile() || (stats.mode & 0o077) !== 0 || (uid !== undefined && stats.uid !== uid)) {
    throw new ProvisioningError("provisioning.secrets_exposed")
  }
  return parseEnvText(await readFile(path, "utf8"))
}

/** The database role's password, from the URL the store holds (never logged). */
export function databasePasswordOf(env: Record<string, string>): string | null {
  const url = env["DATABASE_URL"]
  if (!url) {
    return null
  }
  try {
    return decodeURIComponent(new URL(url).password) || null
  } catch {
    return null
  }
}
