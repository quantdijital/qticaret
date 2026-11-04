/** A shopper's return or exchange request arrived (F7.9); its message hangs off it (F9). */
export const RETURN_REQUEST_CREATED = "return_request.created"

/** The shop approved a return or exchange request (F7.9); the shopper hears how to send it. */
export const RETURN_REQUEST_APPROVED = "return_request.approved"

/**
 * Units of a received parcel were refused (adr/0032 Ek 2026-11-03): a
 * sealed good opened (MSY md. 15/1-ç). The shopper hears which and why.
 */
export const RETURN_REQUEST_REFUSED = "return_request.refused"

/**
 * Staff cancelled an approved request before anything came back: the
 * shopper hears it is off and that nothing need be sent.
 */
export const RETURN_REQUEST_CANCELED = "return_request.canceled"

export interface ReturnRequestEvent {
  id: string
  order_id: string
  kind: "return" | "exchange"
}
