/** A shopper's return or exchange request arrived (F7.9); its message hangs off it (F9). */
export const RETURN_REQUEST_CREATED = "return_request.created"

/** The shop approved a return or exchange request (F7.9); the shopper hears how to send it. */
export const RETURN_REQUEST_APPROVED = "return_request.approved"

export interface ReturnRequestEvent {
  id: string
  order_id: string
  kind: "return" | "exchange"
}
