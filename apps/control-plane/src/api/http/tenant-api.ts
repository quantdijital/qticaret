import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { publicKeyFromRaw, verifySignedRequest } from "@qticaret/server-kit"
import type { SignedRequestErrorCode } from "@qticaret/server-kit"
import { tenantApiNonces } from "../../lib/fleet/nonces"
import { matchTenantApi } from "../../lib/fleet/tenant-api-routes"
import { fleetIn } from "../../workflows/modules"
import { rejectRequest, requestTarget, routePath } from "./request"

/** Who signed a tenant API request, once the guard has checked it. */
export interface TenantCaller {
  tenantId: string
  kid: string
  /** The request's nonce: the answer is bound to it (review L3). */
  nonce: string
}

const callers = new WeakMap<MedusaRequest, TenantCaller>()

/** The shop that signed this request; null when the guard did not pass it. */
export const tenantCallerOf = (req: MedusaRequest): TenantCaller | null => callers.get(req) ?? null

/**
 * What a refusal says (Ek C9). An unknown key and a wrong signature answer
 * alike (`signature.invalid`): a caller cannot learn which shops or keys
 * exist. A stale time is said (a shop's clock is worth knowing about; it
 * is checked before any key is looked up). A replay is said only after a
 * valid signature, so only the key's holder ever sees it.
 */
const REFUSALS: Readonly<Record<SignedRequestErrorCode, { status: number; message: string }>> = {
  "signature.missing_header": { status: 401, message: "signature.malformed" },
  "signature.malformed": { status: 401, message: "signature.malformed" },
  "signature.stale": { status: 401, message: "signature.stale" },
  "signature.unknown_key": { status: 401, message: "signature.invalid" },
  "signature.invalid": { status: 401, message: "signature.invalid" },
  "signature.replayed": { status: 401, message: "signature.replayed" },
}

const hasBody = (req: MedusaRequest): boolean => {
  const length = req.headers["content-length"]
  return req.headers["transfer-encoding"] !== undefined || (length !== undefined && length !== "0")
}

/**
 * A POST's body as received: the bytes the body parser kept, for a JSON
 * request only; null for any other type (or when none was kept).
 */
function rawBodyOf(req: MedusaRequest): Buffer | null {
  const type = (req.headers["content-type"] ?? "").toLowerCase()
  if (type.split(";")[0]?.trim() !== "application/json") {
    return null
  }
  const raw: unknown = (req as { rawBody?: unknown }).rawBody
  return Buffer.isBuffer(raw) ? raw : typeof raw === "string" ? Buffer.from(raw, "utf8") : null
}

/** The exact bytes a guarded POST was signed over, as text; empty for a GET. */
export const signedBodyOf = (req: MedusaRequest): string => rawBodyOf(req)?.toString("utf8") ?? ""

/**
 * The tenant API's guard (adr/0061 §3.2): the route table's row, then the
 * signed request against the shop's `active` or `next` key: ±5 minutes,
 * a nonce used once in 10 minutes (Redis once deployed); a POST's
 * signature covers its exact JSON bytes (Ek C13). Nothing else
 * authenticates here.
 */
export async function guardTenantApi(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const rule = matchTenantApi(req.method, routePath(req))
  if (!rule) {
    rejectRequest(req, res, 404, { type: "not_found", message: "errors.not_found" }, "unlisted")
    return
  }
  // A GET takes no body: one would be signed but never read
  if (rule.maxBodyBytes === 0 && hasBody(req)) {
    rejectRequest(
      req,
      res,
      400,
      { type: "invalid_data", message: "errors.invalid_request" },
      "body_not_allowed"
    )
    return
  }
  // A POST's signature covers the exact bytes sent (Ek C13): JSON only, as
  // the body parser kept them (`preserveRawBody`, held to the route's size)
  const body = rule.maxBodyBytes === 0 ? Buffer.alloc(0) : rawBodyOf(req)
  if (body === null || body.length > rule.maxBodyBytes) {
    rejectRequest(
      req,
      res,
      body === null ? 400 : 413,
      { type: "invalid_data", message: "errors.invalid_request" },
      body === null ? "body_not_json" : "body_too_large"
    )
    return
  }
  const fleet = fleetIn(req.scope)
  let result: Awaited<ReturnType<typeof verifySignedRequest>>
  try {
    result = await verifySignedRequest(
      { method: req.method, path: requestTarget(req), headers: req.headers, body },
      {
        publicKey: async (kid, tenantId) => {
          const key = await fleet.trustedTenantKey(tenantId, kid)
          return key ? publicKeyFromRaw(Buffer.from(key, "base64url")) : undefined
        },
        // The process's logger, not this request (review L7): the store outlives it
        nonces: tenantApiNonces(req.scope.resolve(ContainerRegistrationKeys.LOGGER)),
      }
    )
  } catch {
    // The nonce store (or the key lookup) failed: refused, never let through
    rejectRequest(
      req,
      res,
      503,
      { type: "unavailable", message: "tenant_api.unavailable" },
      "verify_failed"
    )
    return
  }
  if (!result.ok) {
    const refusal = REFUSALS[result.code]
    rejectRequest(
      req,
      res,
      refusal.status,
      { type: "unauthorized", message: refusal.message },
      result.code
    )
    return
  }
  callers.set(req, { tenantId: result.tenantId, kid: result.kid, nonce: result.nonce })
  next()
}
