import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { shipmentOf } from "../order"

const parcel = {
  carrier: "Aras Kargo",
  tracking_number: "QTABC123",
  tracking_url: "https://kargotakip.araskargo.com.tr/?code=QTABC123",
  shipped_at: "2026-11-01T09:00:00.000Z",
  delivered_at: null,
  status: "out_for_delivery",
  status_at: "2026-11-02T07:30:00.000Z",
  items: [{ title: "Çakı", quantity: 2 }],
}

describe("shipmentOf", () => {
  it("says the carrier's last word and when", () => {
    const view = shipmentOf(parcel, t)
    expect(view.status.startsWith(t("order.parcel_out_for_delivery"))).toBe(true)
    expect(view).toMatchObject({ carrier: "Aras Kargo", trackingNumber: "QTABC123" })
    expect(view.items).toBe("Çakı × 2")
  })

  it("reads delivered once it arrived, and on its way when the carrier said nothing known", () => {
    expect(shipmentOf({ ...parcel, delivered_at: "2026-11-02T10:00:00.000Z" }, t).status).toContain(
      t("order.parcel_delivered")
    )
    expect(shipmentOf({ ...parcel, status: null, status_at: null }, t).status).toContain(
      t("order.parcel_in_transit")
    )
  })
})
