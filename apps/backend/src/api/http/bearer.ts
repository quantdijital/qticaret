import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * The bearer token's claims, unchecked: read only where Medusa checks its
 * signature too (its authentication, a reset token's own route).
 */
export function claimsOf(req: MedusaRequest): Record<string, unknown> | null {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1]
  const payload = token?.split(".")[1]
  if (!payload) {
    return null
  }
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    return typeof claims === "object" && claims !== null
      ? (claims as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
