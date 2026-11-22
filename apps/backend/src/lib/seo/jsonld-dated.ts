/**
 * A dated product's own block (adr/0076 §10), beside its `Product`: a
 * `TouristTrip` with its next departures as sub-trips, or an `Event` a
 * departure, as the shop's catalog settings say. Each departure's offer is
 * the lowest price a place sells at, worked out on the server; no shipping
 * or return policy is written (a dated product is a service). A product
 * whose departures have all passed keeps its page and its `Product`: a
 * trip without departures, no event.
 */
import { SCHEMA, compact } from "./jsonld-base"
import type { JsonLd } from "./jsonld-base"

export const DATED_TYPES = ["TouristTrip", "Event"] as const
export type DatedType = (typeof DATED_TYPES)[number]

/** The most departures a page's block names (the nearest first). */
export const DATED_DEPARTURES = 10

export interface DepartureFacts {
  /** ISO times. */
  startsAt: string
  endsAt: string | null
  /** The lowest price a place sells at, TRY; null: none to say. */
  price: number | null
  /** A place is still free and its sales are open. */
  available: boolean
}

export interface DatedFacts {
  type: DatedType
  departures: DepartureFacts[]
}

interface Page {
  name: string
  description: string
  images: string[]
  url: string
  /** The shop's name: the trip's provider, the event's organizer. */
  shop: string
}

function offerOf(departure: DepartureFacts, url: string): JsonLd | undefined {
  if (departure.price === null || !(departure.price > 0)) {
    return undefined
  }
  return {
    "@type": "Offer",
    url,
    price: departure.price.toFixed(2),
    priceCurrency: "TRY",
    availability: `${SCHEMA}/${departure.available ? "InStock" : "SoldOut"}`,
  }
}

const organization = (name: string): JsonLd | undefined =>
  name.trim() ? { "@type": "Organization", name: name.trim() } : undefined

function tripOf(dated: DatedFacts, page: Page): JsonLd {
  return compact({
    "@context": SCHEMA,
    "@type": "TouristTrip",
    name: page.name,
    description: page.description,
    image: page.images,
    url: page.url,
    provider: organization(page.shop),
    subTrip: dated.departures.map((departure) =>
      compact({
        "@type": "TouristTrip",
        name: page.name,
        departureTime: departure.startsAt,
        arrivalTime: departure.endsAt,
        offers: offerOf(departure, page.url),
      })
    ),
  })
}

function eventOf(departure: DepartureFacts, page: Page): JsonLd {
  return compact({
    "@context": SCHEMA,
    "@type": "Event",
    name: page.name,
    description: page.description,
    image: page.images,
    url: page.url,
    startDate: departure.startsAt,
    endDate: departure.endsAt,
    eventStatus: `${SCHEMA}/EventScheduled`,
    eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
    organizer: organization(page.shop),
    offers: offerOf(departure, page.url),
  })
}

/** The dated product's blocks: one trip, or an event a departure (none without departures). */
export function datedJsonLd(dated: DatedFacts, page: Page): JsonLd[] {
  const departures = dated.departures.slice(0, DATED_DEPARTURES)
  return dated.type === "Event"
    ? departures.map((departure) => eventOf(departure, page))
    : [tripOf({ ...dated, departures }, page)]
}
