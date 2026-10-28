/**
 * Where a parcel stands with its carrier (adr/0031), whichever carrier:
 * each maps its own codes onto these. A parcel moves forward only; a
 * return, a failure or a withdrawal ends its way.
 */
export const SHIPMENT_STATUSES = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "returned",
  "failed",
  "canceled",
] as const

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

const RANK: Readonly<Record<ShipmentStatus, number>> = {
  created: 0,
  picked_up: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  returned: 5,
  failed: 5,
  canceled: 5,
}

/** Nothing moves a parcel on from these. */
export const isFinal = (status: ShipmentStatus): boolean => RANK[status] >= RANK.delivered

/** Whether `next` moves the parcel on from `current`: forward only, never out of an end. */
export const movesOn = (current: ShipmentStatus, next: ShipmentStatus): boolean =>
  !isFinal(current) && RANK[next] > RANK[current]

/** The carrier has the parcel: from here the order is handed over. */
export const withCarrier = (status: ShipmentStatus): boolean =>
  RANK[status] >= RANK.picked_up && RANK[status] <= RANK.delivered
