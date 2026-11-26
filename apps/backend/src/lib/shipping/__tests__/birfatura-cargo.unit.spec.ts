import { decideCargo, readCargoTracking } from "../birfatura-cargo"
import type { CargoOrderFacts } from "../birfatura-cargo"
import { birfaturaShipsWith } from "../manager"

const tracking = { carrier: "Aras", number: "AT27NN805", url: null }

const order = (changes: Partial<CargoOrderFacts> = {}): CargoOrderFacts => ({
  id: "order_1",
  status: "pending",
  canceled_at: null,
  fulfillments: [],
  ...changes,
})

describe("BirFatura's cargo write-back (adr/0072 Ek 2026-11-26)", () => {
  it("reads the tracking as the panel does, leaving out what it cannot show", () => {
    expect(
      readCargoTracking({
        cargoTrackingCode: " AT27 NN805 ",
        cargoTrackingCodeUrl: "https://kargotakip.example/AT27NN805",
        cargoCompany: " Aras ",
      })
    ).toEqual({
      carrier: "Aras",
      number: "AT27NN805",
      url: "https://kargotakip.example/AT27NN805",
    })
    expect(
      readCargoTracking({
        cargoTrackingCode: "AT27NN805",
        cargoTrackingCodeUrl: "http://kargotakip.example/x",
        cargoCompany: "Aras\u0000",
      })
    ).toEqual({ carrier: "", number: "AT27NN805", url: null })
    expect(
      readCargoTracking({
        cargoTrackingCode: "AT27NN805",
        cargoTrackingCodeUrl: 'https://x.example/"><script>',
        cargoCompany: null,
      })?.url
    ).toBeNull()
    expect(readCargoTracking({ cargoTrackingCode: "<b>1</b>" })).toBeNull()
    expect(readCargoTracking({ cargoTrackingCode: "12" })).toBeNull()
  })

  it("ships an order BirFatura pulled, whole, with its number", () => {
    expect(decideCargo({ order: order(), exchange: false, pulled: true, tracking })).toEqual({
      action: "ship",
      order_id: "order_1",
    })
  })

  it("names only an order BirFatura pulled from us", () => {
    expect(decideCargo({ order: null, exchange: false, pulled: false, tracking })).toMatchObject({
      action: "refuse",
      reason: "unknown_order",
    })
    expect(decideCargo({ order: order(), exchange: false, pulled: false, tracking })).toMatchObject(
      { action: "refuse", reason: "unknown_order", order_id: null }
    )
    expect(decideCargo({ order: order(), exchange: true, pulled: false, tracking })).toMatchObject({
      action: "refuse",
      reason: "exchange",
    })
  })

  it("answers the same number again with nothing new, and refuses a canceled order or a bad number", () => {
    const shipped = order({
      fulfillments: [
        { canceled_at: "2026-11-20T00:00:00Z", labels: [{ tracking_number: "OTHER1" }] },
        { canceled_at: null, labels: [{ tracking_number: "at27nn805" }] },
      ],
    })
    expect(decideCargo({ order: shipped, exchange: false, pulled: true, tracking })).toEqual({
      action: "already",
      order_id: "order_1",
    })
    // A cancelled parcel's number does not count: the order ships again
    expect(
      decideCargo({
        order: shipped,
        exchange: false,
        pulled: true,
        tracking: { ...tracking, number: "OTHER1" },
      })
    ).toMatchObject({ action: "ship" })
    expect(
      decideCargo({
        order: order({ status: "canceled" }),
        exchange: false,
        pulled: true,
        tracking,
      })
    ).toMatchObject({ action: "refuse", reason: "canceled" })
    expect(
      decideCargo({ order: order(), exchange: false, pulled: true, tracking: null })
    ).toMatchObject({ action: "refuse", reason: "tracking_invalid" })
  })

  it("lets BirFatura manage the parcels only while it is also the invoicing program", () => {
    expect(birfaturaShipsWith({ manager: "birfatura" }, { provider: "birfatura" })).toBe(true)
    expect(birfaturaShipsWith({ manager: "birfatura" }, { provider: "parasut" })).toBe(false)
    expect(birfaturaShipsWith({ manager: "own" }, { provider: "birfatura" })).toBe(false)
  })
})
