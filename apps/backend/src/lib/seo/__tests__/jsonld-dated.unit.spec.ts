import { DATED_DEPARTURES, datedJsonLd } from "../jsonld"
import type { DepartureFacts } from "../jsonld"

// adr/0076 §10: a dated product's trip or events beside its `Product`
const PAGE = {
  name: "Kapadokya Turu",
  description: "Üç günlük Kapadokya gezisi.",
  images: ["https://cdn.example.com/kapadokya.webp"],
  url: "https://magaza.example.com/kapadokya-turu",
  shop: "Örnek Turizm",
}

const departure = (day: number, extra: Partial<DepartureFacts> = {}): DepartureFacts => ({
  startsAt: `2026-12-${String(day).padStart(2, "0")}T06:00:00.000Z`,
  endsAt: `2026-12-${String(day + 2).padStart(2, "0")}T18:00:00.000Z`,
  price: 7500,
  available: true,
  ...extra,
})

describe("datedJsonLd", () => {
  it("makes one trip with the next departures as sub-trips, each with its offer", () => {
    const [trip, ...rest] = datedJsonLd(
      { type: "TouristTrip", departures: [departure(5), departure(12, { price: 8250.5 })] },
      PAGE
    )
    expect(rest).toEqual([])
    expect(trip).toEqual({
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: "Kapadokya Turu",
      description: "Üç günlük Kapadokya gezisi.",
      image: ["https://cdn.example.com/kapadokya.webp"],
      url: PAGE.url,
      provider: { "@type": "Organization", name: "Örnek Turizm" },
      subTrip: [
        {
          "@type": "TouristTrip",
          name: "Kapadokya Turu",
          departureTime: "2026-12-05T06:00:00.000Z",
          arrivalTime: "2026-12-07T18:00:00.000Z",
          offers: {
            "@type": "Offer",
            url: PAGE.url,
            price: "7500.00",
            priceCurrency: "TRY",
            availability: "https://schema.org/InStock",
          },
        },
        {
          "@type": "TouristTrip",
          name: "Kapadokya Turu",
          departureTime: "2026-12-12T06:00:00.000Z",
          arrivalTime: "2026-12-14T18:00:00.000Z",
          offers: {
            "@type": "Offer",
            url: PAGE.url,
            price: "8250.50",
            priceCurrency: "TRY",
            availability: "https://schema.org/InStock",
          },
        },
      ],
    })
  })

  it("never names shipping or a return policy", () => {
    const text = JSON.stringify(
      datedJsonLd({ type: "TouristTrip", departures: [departure(5)] }, PAGE)
    )
    expect(text).not.toMatch(/shippingDetails|hasMerchantReturnPolicy/)
  })

  it("keeps the trip without departures: a product whose dates passed stays on the page", () => {
    const blocks = datedJsonLd({ type: "TouristTrip", departures: [] }, PAGE)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]?.["@type"]).toBe("TouristTrip")
    expect(blocks[0]).not.toHaveProperty("subTrip")
  })

  it("makes an event a departure, and none without one", () => {
    const events = datedJsonLd(
      { type: "Event", departures: [departure(5), departure(12, { price: null, endsAt: null })] },
      PAGE
    )
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      "@type": "Event",
      startDate: "2026-12-05T06:00:00.000Z",
      endDate: "2026-12-07T18:00:00.000Z",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      organizer: { "@type": "Organization", name: "Örnek Turizm" },
      offers: { price: "7500.00", priceCurrency: "TRY" },
    })
    // No price, no end: left out, not made up
    expect(events[1]).not.toHaveProperty("offers")
    expect(events[1]).not.toHaveProperty("endDate")
    expect(datedJsonLd({ type: "Event", departures: [] }, PAGE)).toEqual([])
  })

  it("names at most ten departures, a full one as sold out", () => {
    const many = Array.from({ length: 14 }, (_, index) =>
      departure(1 + index, { available: index !== 0 })
    )
    const [trip] = datedJsonLd({ type: "TouristTrip", departures: many }, PAGE)
    const subTrips = trip?.["subTrip"] as { offers: { availability: string } }[]
    expect(subTrips).toHaveLength(DATED_DEPARTURES)
    expect(subTrips[0]?.offers.availability).toBe("https://schema.org/SoldOut")
  })

  // adr/0078: a trip's program as its itinerary, in order
  it("names the program's steps as the trip's itinerary, a step without text by its title only", () => {
    const [trip] = datedJsonLd(
      {
        type: "TouristTrip",
        departures: [departure(5)],
        itinerary: [
          { name: "Göreme", description: "Vadiler ve kiliseler." },
          { name: "Balon", description: null },
        ],
      },
      PAGE
    )
    expect(trip?.["itinerary"]).toEqual({
      "@type": "ItemList",
      numberOfItems: 2,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Göreme", description: "Vadiler ve kiliseler." },
        { "@type": "ListItem", position: 2, name: "Balon" },
      ],
    })
  })

  it("leaves the itinerary out when the program is absent or empty", () => {
    for (const itinerary of [undefined, []]) {
      const [trip] = datedJsonLd(
        { type: "TouristTrip", departures: [departure(5)], ...(itinerary ? { itinerary } : {}) },
        PAGE
      )
      expect(trip).not.toHaveProperty("itinerary")
    }
  })

  it("gives an event no itinerary", () => {
    const events = datedJsonLd(
      { type: "Event", departures: [departure(5)], itinerary: [{ name: "A", description: null }] },
      PAGE
    )
    expect(events[0]).not.toHaveProperty("itinerary")
  })
})
