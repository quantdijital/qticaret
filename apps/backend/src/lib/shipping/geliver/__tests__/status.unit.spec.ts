import { geliverStatusOf } from "../status"

const shipment = (statusCode: string | null, tracking?: string) => ({
  id: "s",
  statusCode,
  ...(tracking ? { trackingStatus: { trackingStatusCode: tracking } } : {}),
})

describe("geliverStatusOf (adr/0031)", () => {
  it("reads the shipment's status first, its tracking code where the status says nothing", () => {
    expect(geliverStatusOf(shipment("LABEL_PRINTED", "PRE_TRANSIT")).status).toBe("created")
    expect(geliverStatusOf(shipment("SHIPPED", "TRANSIT"))).toEqual({
      status: "in_transit",
      provider_status: "SHIPPED/TRANSIT",
    })
    expect(geliverStatusOf(shipment("LABEL_PRINTED", "TRANSIT")).status).toBe("in_transit")
    expect(geliverStatusOf(shipment("DELIVERED")).status).toBe("delivered")
    expect(geliverStatusOf(shipment("RETURN_SHIPPED")).status).toBe("returned")
    expect(geliverStatusOf(shipment("CANCELED")).status).toBe("canceled")
    expect(geliverStatusOf(shipment(null))).toEqual({ status: "created", provider_status: null })
  })
})
