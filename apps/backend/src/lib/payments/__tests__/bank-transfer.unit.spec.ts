import { bankTransferOf, confirmedAt, transferDeadline } from "../bank-transfer"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../checkout"

const session = (data: Record<string, unknown>) => ({
  id: "payses_1",
  provider_id: BANK_TRANSFER_PAYMENT_PROVIDER_ID,
  amount: 235,
  currency_code: "try",
  data,
})

describe("an order's bank transfer (adr/0029)", () => {
  it("is found in its collection, with whether the money was captured", () => {
    const order = {
      payment_collections: [{ status: "awaiting", payment_sessions: [session({})], payments: [] }],
    }

    expect(bankTransferOf(order)).toMatchObject({ captured: false, session: { id: "payses_1" } })
    expect(
      bankTransferOf({
        payment_collections: [
          { payment_sessions: [session({})], payments: [{ captured_at: "2026-10-28" }] },
        ],
      })?.captured
    ).toBe(true)
    expect(
      bankTransferOf({
        payment_collections: [
          { payment_sessions: [{ ...session({}), provider_id: "pp_cod_cod" }] },
        ],
      })
    ).toBeNull()
  })

  it("runs out the hours the shopper was told after the order, and knows a confirmation", () => {
    expect(transferDeadline("2026-10-28T09:00:00.000Z", session({ deadline_hours: 48 }))).toEqual(
      new Date("2026-10-30T09:00:00.000Z")
    )
    expect(transferDeadline("2026-10-28T09:00:00.000Z", session({}))).toBeNull()
    expect(confirmedAt(session({ confirmed_at: "2026-10-29T10:00:00.000Z" }))).toBe(
      "2026-10-29T10:00:00.000Z"
    )
    expect(confirmedAt(session({}))).toBeNull()
  })
})
