import { cardBalance, cardState, codeFilter } from "../gift-card-list"

const NOW = new Date("2026-11-06T12:00:00Z")

describe("the gift card list (adr/0025)", () => {
  it("reads what is left from the account, else the card's value", () => {
    expect(cardBalance({ value: 500, store_credit_account: { balance: "120" } })).toBe(120)
    expect(cardBalance({ value: 500, store_credit_account: null })).toBe(500)
  })

  it("says active, used or expired; a past last day wins over a balance", () => {
    expect(cardState({ value: 500, expires_at: null }, NOW)).toBe("active")
    expect(cardState({ value: 500, store_credit_account: { balance: 0 } }, NOW)).toBe("used")
    expect(cardState({ value: 500, expires_at: "2026-11-01T00:00:00Z" }, NOW)).toBe("expired")
    expect(cardState({ value: 500, expires_at: "2027-01-01T00:00:00Z" }, NOW)).toBe("active")
  })

  it("matches a code or its start in the stored form, wildcards taken literally", () => {
    expect(codeFilter(" gift-7kq2 ")).toEqual({ $like: "GIFT-7KQ2%" })
    expect(codeFilter("hediye")).toEqual({ $like: "HEDIYE%" })
    expect(codeFilter("GIFT_%")).toEqual({ $like: "GIFT\\_\\%%" })
    expect(codeFilter("  ")).toBeNull()
    expect(codeFilter(undefined)).toBeNull()
  })
})
