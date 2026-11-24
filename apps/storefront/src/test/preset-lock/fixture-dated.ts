import type { ListingAnswer } from "@/lib/store-api/listings"
import type { StoreUpcomingDepartures } from "@qticaret/types"
import { PRODUCTS, priceOf } from "./fixture-shop"

/**
 * The fixed shop's dated answers (preset lock, adr/0077): a preset of a
 * pack that turns dated selling on draws the departures section and the
 * search box's "Nereye" field; no other preset asks for them, so adding
 * these changes no locked page. Fixed days after the lock's clock
 * (2026-11-15), never the real one.
 */

/** Departure days, each a product's: the first two products twice, then one each. */
const DAYS = [
  ["2026-11-28T06:00:00.000Z", 0, 3],
  ["2026-12-05T06:00:00.000Z", 1, null],
  ["2026-12-12T06:00:00.000Z", 0, null],
  ["2026-12-19T06:00:00.000Z", 2, 2],
  ["2027-01-09T06:00:00.000Z", 1, null],
  ["2027-01-23T06:00:00.000Z", 3, 5],
  ["2027-02-06T06:00:00.000Z", 4, null],
] as const

/** `GET /store/departures?limit=` as the backend answers it: by date, `left` only when few. */
export function departuresAnswer(limit: number): StoreUpcomingDepartures {
  return {
    currency: "try",
    departures: DAYS.slice(0, limit).map(([startsAt, index, left], row) => {
      const product = PRODUCTS[index]
      return {
        product: {
          id: product?.id ?? "",
          handle: product?.handle ?? "",
          title: product?.title ?? "",
          thumbnail: product?.thumbnail ?? null,
        },
        slot_id: `slot_${String(row).padStart(2, "0")}`,
        starts_at: startsAt,
        timezone: "Europe/Istanbul",
        left,
        from_price: priceOf(index).current,
      }
    }),
  }
}

const facet = (value: string, label: string, count: number) => ({
  value,
  label,
  count,
  selected: false,
})

/** The whole catalogue's filters (`/magaza`'s): the search box's "Nereye" reads its destination. */
export const SHOP_LISTING: ListingAnswer = {
  product_ids: PRODUCTS.slice(0, 4).map((each) => each.id),
  count: PRODUCTS.length,
  page: 1,
  page_size: 4,
  facets: {
    brands: [],
    attributes: [
      {
        key: "gidilecek_yer",
        label: "Gidilecek yer",
        values: [
          facet("kapadokya", "Kapadokya", 4),
          facet("ege", "Ege", 3),
          facet("karadeniz", "Karadeniz", 2),
          facet("dogu-anadolu", "Doğu Anadolu", 1),
        ],
      },
    ],
    price: { min: 450, max: 1675 },
    stock: { count: 8, selected: false },
  },
}
