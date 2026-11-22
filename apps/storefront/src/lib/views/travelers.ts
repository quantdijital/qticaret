import type {
  TravelerEntryView,
  TravelerGroupView,
  TravelersStepView,
  Translate,
} from "@qticaret/ui"
import { countryOptions } from "../booking/countries"
import type { StoreCartTravelers, StoreTraveler } from "../booking/travelers"
import type { CheckoutCartLine } from "../checkout/cart"
import { bookingMarkOf, departureLabel } from "./booking"

/** A stored traveler as the form shows it: the number only masked, its field left empty. */
const entryOf = (traveler: StoreTraveler): TravelerEntryView => ({
  firstName: traveler.first_name,
  lastName: traveler.last_name,
  // A date column may come back as a whole timestamp
  birthDate: traveler.birth_date ? traveler.birth_date.slice(0, 10) : "",
  nationality: traveler.nationality ?? "",
  documentMasked: traveler.document_masked,
})

/** The departure's product, by name, from the cart line that books it. */
function titleOf(items: readonly CheckoutCartLine[], slotId: string): string {
  const line = items.find((item) => bookingMarkOf(item.metadata)?.slot_id === slotId)
  return line?.product_title ?? line?.title ?? ""
}

/**
 * The travelers step (adr/0076 Ek D6b): one group per departure that
 * asks, its count and level the server's, what was entered by position.
 * Null when the cart asks for none (no step is drawn).
 */
export function travelersView(
  items: readonly CheckoutCartLine[],
  data: StoreCartTravelers | null,
  t: Translate,
  now: Date = new Date()
): TravelersStepView | null {
  if (!data || data.needs.length === 0) {
    return null
  }
  const groups: TravelerGroupView[] = data.needs.map((need) => ({
    slotId: need.slot_id,
    title: titleOf(items, need.slot_id),
    when: need.starts_at ? departureLabel(need.starts_at) : "",
    level: need.level,
    count: need.count,
    people: data.travelers
      .filter((traveler) => traveler.slot_id === need.slot_id)
      .sort((a, b) => a.position - b.position)
      .slice(0, need.count)
      .map(entryOf),
  }))
  const count = groups.reduce((sum, group) => sum + group.count, 0)
  return {
    groups,
    complete: data.complete,
    summary: data.complete ? t("checkout.travelers_summary", { count: String(count) }) : null,
    countries: countryOptions(),
    // The backend's own "not after today" is UTC's day
    maxBirthDate: now.toISOString().slice(0, 10),
  }
}
