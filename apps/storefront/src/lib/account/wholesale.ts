import "server-only"
import { cache } from "react"
import { isStoreApiError } from "../store-api/errors"
import { storeGet } from "../store-api/server"
import { claimsOf, sessionToken } from "./session"

/** The signed-in customer as a wholesaler (ADR-0068 §7). */
export interface Wholesale {
  active: boolean
  /** Prices shown without KDV, KDV as its own line (§5). */
  vatExclusive: boolean
  /** Fewest units an order holds (§8, slice 4); null: no rule. */
  minQuantity: number | null
}

export const RETAIL: Wholesale = Object.freeze({
  active: false,
  vatExclusive: false,
  minQuantity: null,
})

interface WholesaleAnswer {
  wholesale: { active: boolean; vat_exclusive: boolean; min_quantity: number | null }
}

/**
 * Whether this request's shopper buys at wholesale: asked of the backend
 * once per request, only with a session (a guest is never asked about),
 * the customer the session's. Any refusal reads as retail: the public
 * prices show, and the cart still charges what Medusa prices it at.
 */
export const currentWholesale = cache(async (): Promise<Wholesale> => {
  const token = await sessionToken()
  const exp = token ? claimsOf(token).exp : undefined
  if (!token || (exp !== undefined && exp * 1000 <= Date.now())) {
    return RETAIL
  }
  try {
    const { wholesale } = await storeGet<WholesaleAnswer>("/store/customers/me/wholesale")
    return wholesale.active
      ? {
          active: true,
          vatExclusive: wholesale.vat_exclusive,
          minQuantity: wholesale.min_quantity,
        }
      : RETAIL
  } catch (error) {
    if (isStoreApiError(error)) {
      return RETAIL
    }
    throw error
  }
})
