import { Modules } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"

/**
 * Metadata keys the server alone writes on a cart and its lines (fraud
 * signals, held texts, the fee line's marker, add-ons, bookings…).
 */
export const RESERVED_METADATA_PREFIX = "qt_"

type Metadata = Record<string, unknown>

const isReserved = (key: string) => key.startsWith(RESERVED_METADATA_PREFIX)

const reservedKeys = (metadata: unknown): boolean =>
  metadata !== null && typeof metadata === "object" && Object.keys(metadata).some(isReserved)

const metadataOf = (value: unknown): unknown =>
  value !== null && typeof value === "object" ? (value as { metadata?: unknown }).metadata : null

/**
 * Metadata under `qt_` is the server's: a storefront creating or changing a
 * cart, its lines or its addresses may not set it, nor remove it (Medusa
 * deletes a key sent as "").
 */
export function refuseReservedMetadata(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.body as
    | { metadata?: unknown; items?: unknown; shipping_address?: unknown; billing_address?: unknown }
    | undefined
  const items = Array.isArray(body?.items) ? (body.items as unknown[]) : []
  const reserved =
    req.method === "POST" &&
    (reservedKeys(body?.metadata) ||
      items.some((item) => reservedKeys(metadataOf(item))) ||
      reservedKeys(metadataOf(body?.shipping_address)) ||
      reservedKeys(metadataOf(body?.billing_address)))
  next(reserved ? new ValidationError("cart.metadata_reserved", { field: "metadata" }) : undefined)
}

/**
 * What a storefront's `metadata: null` becomes: Medusa merges metadata it
 * is sent but writes `null` as is, wiping the server's keys with the
 * storefront's. The storefront's own keys are removed one by one ("")
 * instead; nothing is sent when it has none.
 */
export function clearedMetadata(current: Metadata | null | undefined): Metadata | undefined {
  const own = Object.keys(current ?? {}).filter((key) => !isReserved(key))
  return own.length ? Object.fromEntries(own.map((key) => [key, ""])) : undefined
}

/**
 * The cart, and the line on a line's route, the request is for. A matcher
 * without methods mounts as a prefix (`/store/carts/:id` runs on the line
 * routes and the others under it too), so the path decides.
 */
const TARGET = /^\/store\/carts\/([^/]+)(?:\/line-items\/([^/]+))?\/?$/

export function metadataTarget(url: string): { cartId: string; lineId?: string } | null {
  const match = TARGET.exec(url.split("?")[0] ?? "")
  if (!match?.[1]) {
    return null
  }
  return match[2] ? { cartId: match[1], lineId: match[2] } : { cartId: match[1] }
}

async function currentMetadata(
  req: MedusaRequest,
  target: { cartId: string; lineId?: string }
): Promise<Metadata | null> {
  const cartModule = req.scope.resolve(Modules.CART)
  if (target.lineId) {
    const [line] = await cartModule.listLineItems(
      { id: target.lineId, cart_id: target.cartId },
      { select: ["id", "metadata"] }
    )
    return line?.metadata ?? null
  }
  const [cart] = await cartModule.listCarts({ id: target.cartId }, { select: ["id", "metadata"] })
  return cart?.metadata ?? null
}

const replaceMetadata = (holder: unknown, metadata: Metadata | undefined) => {
  if (holder === null || typeof holder !== "object" || !("metadata" in holder)) {
    return
  }
  const body = holder as { metadata?: unknown }
  if (metadata) {
    body.metadata = metadata
  } else {
    delete body.metadata
  }
}

/**
 * A storefront's `metadata: null` on a cart or a line clears its own keys
 * and keeps the server's (`{}` and the storefront's own keys are merged by
 * Medusa and keep them already). Both the raw and the validated body are
 * rewritten: this may run before or after Medusa's body validation.
 */
export async function keepReservedMetadata(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = req.body as { metadata?: unknown } | undefined
  const validated = (req as { validatedBody?: { metadata?: unknown } }).validatedBody
  const nulled = (holder: { metadata?: unknown } | undefined) =>
    !!holder && "metadata" in holder && holder.metadata === null
  const target = metadataTarget(req.originalUrl)
  if (req.method !== "POST" || !target || !(nulled(body) || nulled(validated))) {
    next()
    return
  }
  try {
    const current = await currentMetadata(req, target)
    if (Object.keys(current ?? {}).some(isReserved)) {
      const cleared = clearedMetadata(current)
      replaceMetadata(body, cleared)
      replaceMetadata(validated, cleared)
    }
    next()
  } catch (error) {
    next(error)
  }
}
