import { SECTIONS } from "../../../modules/platform-settings/sections"
import type { BookingFlowSettings } from "../../../modules/platform-settings/sections"
import { CANCEL_BY_CONTACT, bookingFlow, byContact, cancelContactOf } from "../flow"

const OFF: BookingFlowSettings = {
  voucher_enabled: false,
  voucher_off_note: "Sizi arayacağız.",
  online_cancel_enabled: false,
  cancel_off_note: null,
}

const containerWith = (flag: boolean, booking: BookingFlowSettings) => {
  const sections: Record<string, unknown> = {
    booking,
    store: { contact_phone: "+902125550000", contact_email: "tur@ornek.example" },
  }
  const getSection = jest.fn((name: string) => Promise.resolve(sections[name]))
  const service = { isFeatureEnabled: jest.fn(() => Promise.resolve(flag)), getSection }
  return { container: { resolve: jest.fn(() => service) } as never, getSection }
}

describe("the simple path of dated products (adr/0076 Ek basit yol)", () => {
  it("keeps every detailed flow on by default", () => {
    expect(SECTIONS.booking.defaults).toEqual({
      voucher_enabled: true,
      voucher_off_note: null,
      online_cancel_enabled: true,
      cancel_off_note: null,
    })
  })

  it("reads the shop's choice while dated selling is on", async () => {
    const { container } = containerWith(true, OFF)
    expect(await bookingFlow(container)).toEqual(OFF)
  })

  it("ignores the shop's choice while dated selling is off", async () => {
    const { container, getSection } = containerWith(false, OFF)
    expect(await bookingFlow(container)).toEqual(SECTIONS.booking.defaults)
    expect(getSection).not.toHaveBeenCalled()
  })

  it("checks the notes as plain text, an empty one the default", () => {
    const saved = SECTIONS.booking.full.safeParse({ ...OFF, cancel_off_note: "  " })
    expect(saved.success && saved.data.cancel_off_note).toBeNull()
    expect(
      SECTIONS.booking.full.safeParse({ ...OFF, voucher_off_note: "x".repeat(501) }).success
    ).toBe(false)
    expect(SECTIONS.booking.patch.safeParse({ voucher_enabled: "yes" }).success).toBe(false)
    expect(SECTIONS.booking.patch.safeParse({ online_cancel_enabled: false }).success).toBe(true)
  })

  it("refuses every live departure's online cancel and says how to reach the shop", async () => {
    const { container } = containerWith(true, OFF)
    const contact = await cancelContactOf(container, OFF)
    expect(contact).toEqual({
      note: null,
      phone: "+902125550000",
      email: "tur@ornek.example",
    })
    const view = byContact(
      {
        currency_code: "try",
        departures: [
          { slot_id: "a", cancelled: false, cancellable: true, refusal: null },
          { slot_id: "b", cancelled: true, cancellable: false, refusal: null },
        ],
      },
      contact
    )
    expect(view.departures).toEqual([
      { slot_id: "a", cancelled: false, cancellable: false, refusal: CANCEL_BY_CONTACT },
      { slot_id: "b", cancelled: true, cancellable: false, refusal: null },
    ])
    expect(view.contact).toBe(contact)
  })
})
