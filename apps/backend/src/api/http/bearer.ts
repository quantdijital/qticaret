import type { MedusaRequest } from "@medusajs/framework/http"

/**
 * The bearer token as Medusa takes it: the header's second word after a
 * `Bearer` first, whatever follows (security review 2026-10-31: a strict
 * reading here let `Bearer <token> x` past our checks and into Medusa's).
 */
export function bearerTokenOf(req: MedusaRequest): string | null {
  const [scheme, token] = (req.headers.authorization ?? "").trim().split(/\s+/)
  return scheme?.toLowerCase() === "bearer" && token ? token : null
}

/**
 * The bearer token's claims, unchecked: read only where Medusa checks its
 * signature too (its authentication, a reset token's own route).
 */
export function claimsOf(req: MedusaRequest): Record<string, unknown> | null {
  const payload = bearerTokenOf(req)?.split(".")[1]
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
