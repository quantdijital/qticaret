import { describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"
import { voucherHtml } from "@/lib/orders/voucher"
import type { VoucherRow } from "@/lib/orders/voucher"

vi.mock("@/lib/store-api/server", () => ({ storeCall: vi.fn() }))

const DEPARTURE: VoucherRow["departures"][number] = {
  title: "Kapadokya <turu>",
  when: "12 Mayıs 2027 Çarşamba 08:30",
  starts_at: "2027-05-12T05:30:00.000Z",
  meeting_point: "Kadıköy & iskele",
  units: 3,
  cancelled: false,
}

const VOUCHER: VoucherRow = {
  order_number: "1042",
  status: "valid",
  code: "ABCD-EFGH-JKMN-PQRS",
  departures: [DEPARTURE],
}

describe("a booking's voucher page (adr/0076 Ek D7b)", () => {
  it("prints the order, the code, the departure and its places, escaped", () => {
    const html = voucherHtml([VOUCHER], t)

    expect(html).toContain("Sipariş #1042")
    expect(html).toContain("<code>ABCD-EFGH-JKMN-PQRS</code>")
    expect(html).toContain("Geçerli rezervasyon")
    expect(html).toContain("Kapadokya &lt;turu&gt;")
    expect(html).toContain("Buluşma yeri: Kadıköy &amp; iskele")
    expect(html).toContain("Katılımcı: 3 kişi")
    expect(html).not.toContain("<turu>")
  })

  it("says a cancelled booking and departure are cancelled, with no meeting point when none", () => {
    const html = voucherHtml(
      [
        {
          ...VOUCHER,
          status: "cancelled",
          departures: [{ ...DEPARTURE, meeting_point: null, cancelled: true }],
        },
      ],
      t
    )

    expect(html).toContain("Bu rezervasyon iptal edildi")
    expect(html).toContain("Bu kalkış iptal edildi")
    expect(html).not.toContain("Buluşma yeri")
  })

  it("leaves no key unwritten", () => {
    expect(voucherHtml([VOUCHER], t)).not.toMatch(/voucher\.\w+/)
  })
})
