import { z } from "@medusajs/framework/zod"
import {
  EnvValidationError,
  isLocalEnv,
  parsePublicKeys,
  parseSigningKey,
} from "@qticaret/server-kit"
import { tenantIdSchema } from "@qticaret/types/control-plane"

/**
 * The control plane's variables in the shop's env schema (adr/0061 §3.3,
 * Ek C9). All four are optional on a developer's machine and in tests
 * (unmanaged mode when the public keys are unset), required once deployed:
 * a misconfigured shop must not quietly run without limits. Their shapes and
 * pairings are checked with the rest of the schema (lib/env.ts); the
 * "required once deployed" rule is `assertControlPlaneConfigured`, run at
 * boot by medusa-config (Ek C9: the env tests' full production fixtures
 * stay as they are). Messages name the variable, never its value (one of
 * them is a private key).
 */

const parses = (parse: (value: string) => unknown) => (value: string) => {
  try {
    parse(value)
    return true
  } catch {
    return false
  }
}

export const CONTROL_PLANE_ENV = {
  // The control plane's internal base URL: the plan's pull (`/tenant-api/v1/plan`)
  CONTROL_PLANE_URL: z
    .url({ protocol: /^https?$/, error: "must be an http(s) URL" })
    .refine((value) => {
      const url = new URL(value)
      return url.username === "" && url.password === "" && url.search === "" && url.hash === ""
    }, "must be a base URL without credentials or query")
    .optional(),
  // The control plane's Ed25519 public keys, comma-separated (several while one rotates)
  CONTROL_PLANE_PUBLIC_KEYS: z
    .string()
    .max(2000)
    .refine(
      parses((value) => parsePublicKeys(value, "CONTROL_PLANE_PUBLIC_KEYS")),
      "must list 32-byte public keys in base64url"
    )
    .optional(),
  // This shop's id at the control plane (`ten_…`): documents for any other are refused
  TENANT_ID: tenantIdSchema.optional(),
  // This shop's Ed25519 private key (its 32-byte seed, base64url): it signs the pull
  TENANT_SIGNING_KEY: z
    .string()
    .max(100)
    .refine(
      parses((value) => parseSigningKey(value, "TENANT_SIGNING_KEY")),
      "must be a 32-byte key in base64url"
    )
    .optional(),
}

type ControlPlaneEnv = { [K in keyof typeof CONTROL_PLANE_ENV]?: string | undefined }

const NAMES = Object.keys(CONTROL_PLANE_ENV) as (keyof typeof CONTROL_PLANE_ENV)[]

// A single-label DNS name (a Docker service name, `localhost`): the internal
// network. Never an IP literal, bracketed IPv6 included (C9 review L5)
const INTERNAL_HOST = /^[a-z0-9-]+$/

/** Whether `http:` may reach this URL once deployed: a single-label host name only. */
export function isInternalHost(value: string): boolean {
  return INTERNAL_HOST.test(new URL(value).hostname)
}

/**
 * Anywhere but a developer's machine and the tests the shop starts only
 * managed (adr/0061 §3.3): every one of the four set. An unset NODE_ENV
 * counts as deployed, as everywhere else in the schema (C9 review M2).
 * Called at boot after the schema; throws the schema's own error, naming
 * the missing variables.
 */
export function assertControlPlaneConfigured(
  env: ControlPlaneEnv & { NODE_ENV?: string | undefined }
): void {
  if (isLocalEnv({ NODE_ENV: env.NODE_ENV })) {
    return
  }
  const missing = NAMES.filter((name) => env[name] === undefined)
  if (missing.length > 0) {
    throw new EnvValidationError(
      `Invalid environment configuration:\n${missing
        .map((name) => `  - ${name}: is required outside development and test`)
        .join("\n")}`
    )
  }
}

/** The cross-variable rules, added to the shop's schema (lib/env.ts); `deployed`: not local. */
export function checkControlPlaneEnv(
  env: ControlPlaneEnv,
  deployed: boolean,
  issue: (path: string, message: string) => void
): void {
  if (env.CONTROL_PLANE_PUBLIC_KEYS !== undefined && env.TENANT_ID === undefined) {
    issue("TENANT_ID", "is required with CONTROL_PLANE_PUBLIC_KEYS")
  }
  // The pull needs both halves, and something to check what it pulls
  const pull = [env.CONTROL_PLANE_URL, env.TENANT_SIGNING_KEY].filter((each) => each !== undefined)
  if (pull.length === 1) {
    issue(
      env.CONTROL_PLANE_URL === undefined ? "CONTROL_PLANE_URL" : "TENANT_SIGNING_KEY",
      "is required with the other of CONTROL_PLANE_URL and TENANT_SIGNING_KEY"
    )
  }
  if (pull.length === 2 && env.CONTROL_PLANE_PUBLIC_KEYS === undefined) {
    issue("CONTROL_PLANE_PUBLIC_KEYS", "is required with CONTROL_PLANE_URL")
  }
  // Deployed: TLS, or the internal network (adr/0061 §3.4: /tenant-api is internal only)
  const url = env.CONTROL_PLANE_URL
  if (deployed && url?.startsWith("http:") && !isInternalHost(url)) {
    issue(
      "CONTROL_PLANE_URL",
      "must be https outside development and test, unless a single-label internal host name"
    )
  }
}
