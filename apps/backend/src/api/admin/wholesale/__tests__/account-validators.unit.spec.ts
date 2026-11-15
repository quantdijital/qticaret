import {
  AdminGetWholesaleAccounts,
  AdminPostWholesaleAccount,
  AdminPostWholesaleAccountAction,
  AdminUpdateWholesaleAccount,
} from "../account-validators"

const messages = (body: unknown) => {
  const parsed = AdminPostWholesaleAccount.safeParse(body)
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

// A VKN that passes the checksum, made up for the test
const VKN = "1234567890"

describe("a new wholesaler's body (ADR-0068 §3)", () => {
  it("takes an address and a contact with a level, lower-casing the address", () => {
    expect(
      AdminPostWholesaleAccount.parse({
        email: "  Toptan@Firma.com ",
        contact_name: " Ali Kaya ",
        tier_id: "wtier_1",
      })
    ).toEqual({
      email: "toptan@firma.com",
      contact_name: "Ali Kaya",
      company_name: null,
      tier_id: "wtier_1",
      own_prices: false,
      percent: null,
      min_quantity: null,
    })
  })

  it("takes its own prices instead of a level, a rate opening them", () => {
    const body = { email: "a@firma.com", contact_name: "Ali Kaya" }
    expect(AdminPostWholesaleAccount.safeParse({ ...body, own_prices: true }).success).toBe(true)
    expect(AdminPostWholesaleAccount.safeParse({ ...body, percent: 12.5 }).success).toBe(true)
    expect(messages(body)).toEqual(["wholesale.no_price_source"])
  })

  it("takes the tax office and number together, with a company and a valid number", () => {
    const body = {
      email: "a@firma.com",
      contact_name: "Ali Kaya",
      tier_id: "wtier_1",
      company_name: "Kaya Bıçak Ltd",
    }
    expect(
      AdminPostWholesaleAccount.parse({ ...body, tax_office: "Kadıköy", tax_id: "123 456 7890" })
    ).toMatchObject({ tax_office: "Kadıköy", tax_id: VKN })
    expect(messages({ ...body, tax_office: "Kadıköy" })).toContain("wholesale.tax_pair")
    expect(messages({ ...body, tax_id: VKN })).toContain("wholesale.tax_pair")
    expect(messages({ ...body, tax_office: "Kadıköy", tax_id: "12345" })).toContain(
      "billing_profile.tax_id_invalid"
    )
    expect(messages({ ...body, company_name: null, tax_office: "Kadıköy", tax_id: VKN })).toContain(
      "wholesale.company_for_tax"
    )
  })

  it("never takes a password, a Medusa group or list, a status or a customer id", () => {
    const body = { email: "a@firma.com", contact_name: "Ali Kaya", tier_id: "wtier_1" }
    for (const extra of [
      { password: "x" },
      { private_group_id: "cusgroup_x" },
      { private_price_list_id: "plist_x" },
      { customer_group_id: "cusgroup_x" },
      { status: "active" },
      { customer_id: "cus_x" },
    ]) {
      expect(AdminPostWholesaleAccount.safeParse({ ...body, ...extra }).success).toBe(false)
    }
  })

  it("refuses an address that is none, a one-letter contact, a rate out of bounds", () => {
    const body = { email: "a@firma.com", contact_name: "Ali Kaya", tier_id: "wtier_1" }
    for (const bad of [
      { email: "firma.com" },
      { contact_name: "A" },
      { percent: 0 },
      { percent: 99.5 },
      { min_quantity: 0 },
    ]) {
      expect(AdminPostWholesaleAccount.safeParse({ ...body, ...bad }).success).toBe(false)
    }
  })
})

describe("a wholesaler changed", () => {
  it("takes any field, null taking a level, rate, minimum or name away, never nothing", () => {
    expect(AdminUpdateWholesaleAccount.parse({ tier_id: null })).toEqual({ tier_id: null })
    expect(AdminUpdateWholesaleAccount.parse({ own_prices: true, percent: 5 })).toEqual({
      own_prices: true,
      percent: 5,
    })
    expect(AdminUpdateWholesaleAccount.safeParse({}).success).toBe(false)
    // The own list is never closed by this route; a state is changed by its own routes
    expect(AdminUpdateWholesaleAccount.safeParse({ own_prices: false }).success).toBe(false)
    expect(AdminUpdateWholesaleAccount.safeParse({ status: "inactive" }).success).toBe(false)
    expect(AdminUpdateWholesaleAccount.safeParse({ email: "b@firma.com" }).success).toBe(false)
  })

  it("takes no body for a state change or a resend", () => {
    expect(AdminPostWholesaleAccountAction.safeParse({}).success).toBe(true)
    expect(AdminPostWholesaleAccountAction.safeParse({ status: "active" }).success).toBe(false)
  })
})

describe("a page of wholesalers", () => {
  it("reads limit, offset, search and state, 50 from the start by default", () => {
    expect(AdminGetWholesaleAccounts.parse({})).toEqual({ limit: 50, offset: 0 })
    expect(
      AdminGetWholesaleAccounts.parse({ limit: "10", offset: "20", q: " kaya ", status: "pending" })
    ).toEqual({ limit: 10, offset: 20, q: "kaya", status: "pending" })
    for (const query of [{ limit: "101" }, { status: "deleted" }, { customer_id: "cus_x" }]) {
      expect(AdminGetWholesaleAccounts.safeParse(query).success).toBe(false)
    }
  })
})
