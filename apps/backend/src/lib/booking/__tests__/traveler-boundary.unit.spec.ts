import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const SRC = join(__dirname, "../../..")

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "node_modules" ? [] : sources(path)
    }
    return name.endsWith(".ts") ? [path] : []
  })
}

// What reads or writes a traveler's row: the model, its table, its methods and the functions
// that carry its rows out (the panel's list, the storefront's view)
const TOUCHES =
  /BookingTravelers?\b|\bbooking_traveler\b|revealTravelerDocument|setCartTravelers|attachTravelers|moveOrderTravelers|cartTravelersView|eraseCartTravelers|readSlotBookings|unbookedTravelers/

/**
 * A traveler's details stay with the booking (adr/0076 §7): they reach no
 * log, e-invoice, payment provider, AI service, message or export. The
 * code that touches them is this list; a new reader is a decision, made
 * here on purpose and reviewed (KVKK).
 */
const ALLOWED = [
  "api/admin/booking-slots/[id]/bookings/route.ts",
  "api/admin/booking-slots/bookings-view.ts",
  "api/admin/booking-travelers/[id]/reveal/route.ts",
  "api/admin/booking-travelers/erase/route.ts",
  "api/admin/booking-travelers/search/route.ts",
  "api/store/carts/[id]/travelers/route.ts",
  "modules/booking/migrations/Migration20261122095448.ts",
  "modules/booking/models/booking-traveler.ts",
  "modules/booking/service.ts",
  "modules/booking/traveler-attach.ts",
  "modules/booking/travelers.ts",
  "workflows/booking/cart/travelers.ts",
  "workflows/booking/orders.ts",
  "workflows/booking/reconcile-travelers.ts",
  "workflows/booking/traveler-retention.ts",
  "workflows/booking/traveler-requests.ts",
  "workflows/legal/customer-data.ts",
  "workflows/legal/erasure/traces.ts",
]

describe("where travelers' details go (adr/0076 §7)", () => {
  it("is touched only by the booking's own code, its panel reading, retention and erasure", () => {
    const found = sources(SRC)
      .filter((path) => TOUCHES.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path).split("\\").join("/"))
      .sort()
    expect(found).toEqual([...ALLOWED].sort())
  })
})
