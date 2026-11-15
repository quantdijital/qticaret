import { accountMatches } from "../accounts/read"
import type { AccountRead } from "../accounts/read"

const account = (fields: Partial<AccountRead>): AccountRead => ({
  id: "wacc_1",
  status: "active",
  email: "satis@kayabicak.com",
  company_name: "KAYA BIÇAK",
  contact_name: "Ali Kaya",
  customer: null,
  tier: null,
  own_prices: false,
  rate_bps: null,
  min_quantity: null,
  sync_pending: false,
  invited_at: null,
  invitation_expires_at: null,
  activated_at: null,
  deactivated_at: null,
  created_at: new Date(0),
  ...fields,
})

describe("finding a wholesaler on the panel's list (ADR-0068 §3)", () => {
  it("finds by address, company or contact, every word, Turkish case folded", () => {
    expect(accountMatches(account({}), "bıçak")).toBe(true)
    expect(accountMatches(account({}), "ali kayabicak")).toBe(true)
    expect(accountMatches(account({}), "Satis@")).toBe(true)
    expect(accountMatches(account({}), "veli")).toBe(false)
    expect(accountMatches(account({}), undefined)).toBe(true)
    expect(accountMatches(account({}), "   ")).toBe(true)
  })

  it("reads a pending one with nothing but its address", () => {
    const pending = account({ status: "pending", company_name: null, contact_name: null })
    expect(accountMatches(pending, "kayabicak")).toBe(true)
    expect(accountMatches(pending, "ali")).toBe(false)
  })
})
