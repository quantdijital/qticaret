import { EXCHANGE_ORDER_ID_BASE, MAX_EXCHANGES_PER_ORDER } from "./types"

/**
 * BirFatura's `OrderId` and `OrderCode` for a sale invoice (adr/0072 §5):
 * the order's number for its first sale; an exchange's new sale, its n-th,
 * apart from it (`1e12 + number × 100 + n`, `"<number>-D<n>"`). Both stay
 * the same every pull, as BirFatura asks ("Aynı sipariş tekrar dönecekse
 * aynı OrderId ve OrderCode kullanılmalıdır").
 */

export interface SaleRef {
  display_id: number
  /** 0 for the first sale; n for the order's n-th exchange invoice. */
  exchange: number
}

export function birfaturaOrderId(ref: SaleRef): { id: number; code: string } | null {
  if (!Number.isSafeInteger(ref.display_id) || ref.display_id < 1) {
    return null
  }
  if (ref.exchange === 0) {
    return { id: ref.display_id, code: String(ref.display_id) }
  }
  if (
    !Number.isInteger(ref.exchange) ||
    ref.exchange < 1 ||
    ref.exchange > MAX_EXCHANGES_PER_ORDER
  ) {
    return null
  }
  const id = EXCHANGE_ORDER_ID_BASE + ref.display_id * 100 + ref.exchange
  return Number.isSafeInteger(id)
    ? { id, code: `${String(ref.display_id)}-D${String(ref.exchange)}` }
    : null
}

/** Which sale an `OrderId` BirFatura sends back names; null for one we never gave. */
export function saleRefOf(orderId: number): SaleRef | null {
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return null
  }
  if (orderId < EXCHANGE_ORDER_ID_BASE) {
    return { display_id: orderId, exchange: 0 }
  }
  const rest = orderId - EXCHANGE_ORDER_ID_BASE
  const exchange = rest % 100
  const displayId = Math.floor(rest / 100)
  return exchange >= 1 && displayId >= 1 ? { display_id: displayId, exchange } : null
}
