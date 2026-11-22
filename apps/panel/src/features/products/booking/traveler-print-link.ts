/** A departure's id as the print page takes it from its address. */
export const SLOT_ID = /^bkslot_[0-9A-Za-z]{1,64}$/

/**
 * Opens the departure's traveler list on a page of its own that prints
 * itself (as the orders' packing slips); the panel tab stays. The numbers
 * stay masked there: the list is for the trip, not a copy to keep.
 */
export function openTravelerPrint(slotId: string, zone: string, startsAt: string): void {
  const query = new URLSearchParams({ slot: slotId, zone, at: startsAt })
  window.open(`/print/departure?${query.toString()}`, "_blank", "noopener")
}
