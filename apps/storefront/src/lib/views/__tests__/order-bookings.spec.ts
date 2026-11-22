import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import type { OrderDepartureRow } from "@/lib/orders/bookings"
import { orderBookingsOf } from "../order-bookings"

const row = (over: Partial<OrderDepartureRow> = {}): OrderDepartureRow => ({
  slot_id: "bkslot_1",
  starts_at: "2026-12-12T06:00:00.000Z",
  timezone: "Europe/Istanbul",
  titles: ["Kapadokya turu", "Çocuk"],
  cancelled: false,
  cancellable: true,
  refusal: null,
  days_before: 20,
  fee_percent: 20,
  paid: "1000",
  refund: "800",
  refund_within_days: 14,
  ...over,
})

describe("orderBookingsOf (adr/0076 Ek D7a)", () => {
  it("is null for an order without departures, so the page is drawn as before", () => {
    expect(orderBookingsOf(null, t)).toBeNull()
    expect(orderBookingsOf({ currency_code: "try", departures: [] }, t)).toBeNull()
  })

  it("words the backend's refund with its share kept, and when the money comes", () => {
    const [view] = orderBookingsOf({ currency_code: "try", departures: [row()] }, t) ?? []
    expect(view?.departure).toContain("12 Aralık 2026")
    expect({ ...view, departure: null }).toEqual({
      slotId: "bkslot_1",
      departure: null,
      titles: "Kapadokya turu, Çocuk",
      cancelled: false,
      cancellable: true,
      refund: "Şimdi iptal ederseniz 800,00 TL iade edilir (%20 kesinti).",
      refundNote: "İade en geç 14 gün içinde yapılır.",
      note: null,
    })
    expect(view?.departure).toContain("09:00")
    const [free] =
      orderBookingsOf(
        {
          currency_code: "try",
          departures: [row({ fee_percent: 0, refund: "1000", refund_within_days: null })],
        },
        t
      ) ?? []
    expect(free?.refund).toBe("Şimdi iptal ederseniz 1.000,00 TL iade edilir (kesinti yok).")
    expect(free?.refundNote).toBeNull()
  })

  it("says why not in the page's words, a refusal it does not know as the general one", () => {
    const views =
      orderBookingsOf(
        {
          currency_code: "try",
          departures: [
            row({ cancellable: false, refusal: "booking.cancel_too_late" }),
            row({ slot_id: "bkslot_2", cancellable: false, refusal: "booking.something_new" }),
            row({ slot_id: "bkslot_3", cancelled: true, cancellable: false }),
          ],
        },
        t
      ) ?? []
    expect(views.map((view) => [view.refund, view.note])).toEqual([
      [null, t("booking.cancel_too_late")],
      [null, t("order.booking_cancel_unavailable")],
      [null, null],
    ])
    expect(t("booking.cancel_too_late")).not.toBe("booking.cancel_too_late")
  })

  it("puts the shop's note and contacts where the cancel was while it takes cancels by phone (Ek basit yol)", () => {
    const byContact = row({ cancellable: false, refusal: "booking.cancel_by_contact" })
    const [plain] =
      orderBookingsOf(
        {
          currency_code: "try",
          departures: [byContact],
          contact: { note: null, phone: "+902125550000", email: "tur@ornek.example" },
        },
        t
      ) ?? []
    expect(plain?.cancellable).toBe(false)
    expect(plain?.refund).toBeNull()
    expect(plain?.note).toBe(
      "İptal ve değişiklik için bizimle iletişime geçin. Telefon: 0212 555 00 00 E-posta: tur@ornek.example"
    )
    const [own] =
      orderBookingsOf(
        {
          currency_code: "try",
          departures: [byContact],
          contact: { note: "Bizi hafta içi arayın.", phone: null, email: null },
        },
        t
      ) ?? []
    expect(own?.note).toBe("Bizi hafta içi arayın.")
  })

  it("draws a departure exactly as before when the backend sends no contact", () => {
    const found = { currency_code: "try", departures: [row()] }
    expect(orderBookingsOf({ ...found }, t)).toEqual(orderBookingsOf(found, t))
    expect(orderBookingsOf(found, t)?.[0]?.note).toBeNull()
  })
})
