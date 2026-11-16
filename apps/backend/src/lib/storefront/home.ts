import type { Env } from "../env"
import { parseEnv, storefrontOrigin } from "../env"

const HTTP = new Set(["http:", "https:"])

/** An address's origin when it is an http(s) one, else null. */
function httpOrigin(address: string): string | null {
  try {
    const url = new URL(address)
    return HTTP.has(url.protocol) ? url.origin : null
  } catch {
    return null
  }
}

/**
 * Where the panel's "Mağazayı görüntüle" opens (the owner, 2026-11-16):
 * the shop's bound domain over https, else the storefront's origin as the
 * operator set it (`STOREFRONT_ORIGIN`; on a developer's machine
 * localhost:8000 when unset), else null (no button). Never from a
 * request: the domain is the SEO section's validated host, the origin the
 * validated environment. An origin only, so no path or query rides along.
 */
export function storefrontHome(
  canonicalHost: string | null | undefined,
  env: Pick<Env, "STOREFRONT_ORIGIN" | "NODE_ENV"> = parseEnv()
): string | null {
  if (canonicalHost) {
    // A host alone (the SEO schema's): one that reads as more (a path, a user) is none
    const origin = httpOrigin(`https://${canonicalHost}`)
    return origin === `https://${canonicalHost.toLowerCase()}` ? origin : null
  }
  const origin = storefrontOrigin(env)
  return origin ? httpOrigin(origin) : null
}
