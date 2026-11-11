import type { KeyObject } from "node:crypto"
import { parsePublicKeys, parseSigningKey } from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"

/**
 * How this shop talks to the control plane (adr/0061 §3.2, §3.3, Ek C9),
 * from the environment the boot's schema has already checked:
 *
 * - `CONTROL_PLANE_PUBLIC_KEYS`: the keys plan documents are checked
 *   against. Unset: **unmanaged** (today's development and tests): status
 *   `active`, no limits, platform flags at their defaults, the push
 *   endpoint answers 404 and nothing is pulled
 * - `TENANT_ID`: this shop's id; a document for any other is refused
 * - `CONTROL_PLANE_URL` + `TENANT_SIGNING_KEY`: the pull (optional on a
 *   developer's machine; required once deployed)
 *
 * Rebuilt only when a value changes; the signing key stays in this
 * process's memory, never in a log or an error (messages name variables).
 */
export interface ControlPlaneConfig {
  managed: boolean
  publicKeys: ReadonlyMap<string, KeyObject>
  tenantId: string | null
  url: string | null
}

const UNMANAGED: ControlPlaneConfig = Object.freeze({
  managed: false,
  publicKeys: new Map<string, KeyObject>(),
  tenantId: null,
  url: null,
})

let cached: { raw: string; config: ControlPlaneConfig } | undefined
let cachedSigner: { raw: string; signer: Ed25519Signer } | undefined

const value = (env: NodeJS.ProcessEnv, name: string): string | null => {
  const raw = env[name]?.trim()
  return raw === undefined || raw === "" ? null : raw
}

export function controlPlaneConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  const keys = value(env, "CONTROL_PLANE_PUBLIC_KEYS")
  const tenantId = value(env, "TENANT_ID")
  const url = value(env, "CONTROL_PLANE_URL")
  if (keys === null) {
    return UNMANAGED
  }
  const raw = JSON.stringify([keys, tenantId, url])
  if (cached?.raw !== raw) {
    cached = {
      raw,
      config: {
        managed: true,
        publicKeys: parsePublicKeys(keys, "CONTROL_PLANE_PUBLIC_KEYS"),
        tenantId,
        url: url ? new URL(url).origin : null,
      },
    }
  }
  return cached.config
}

/** The shop's own signing key (`TENANT_SIGNING_KEY`), or null when unset. */
export function tenantSigner(env: NodeJS.ProcessEnv = process.env): Ed25519Signer | null {
  const raw = value(env, "TENANT_SIGNING_KEY")
  if (raw === null) {
    return null
  }
  if (cachedSigner?.raw !== raw) {
    cachedSigner = { raw, signer: parseSigningKey(raw, "TENANT_SIGNING_KEY") }
  }
  return cachedSigner.signer
}
