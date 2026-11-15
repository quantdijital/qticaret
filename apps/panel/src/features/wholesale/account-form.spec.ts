import { describe, expect, it } from "vitest"
import {
  accountSchema,
  blankAccount,
  createBodyOf,
  editSchema,
  editValuesOf,
  minimumOf,
  tierBodyOf,
  updateBodyOf,
} from "./account-form"
import type { AccountValues } from "./account-form"
import { account } from "./wholesale.fixtures"

const E = "wholesale.form.errors"

const valid: AccountValues = {
  ...blankAccount,
  email: " Satinalma@KayaBicak.com.tr ",
  contact_name: "Ali Kaya",
  tier_id: "wst_1",
}

const issues = (values: AccountValues) => {
  const parsed = accountSchema.safeParse(values)
  return parsed.success
    ? {}
    : // The first message a field gets is the one the form shows
      Object.fromEntries(
        parsed.error.issues
          .map((issue): [string, string] => [issue.path.join("."), issue.message])
          .reverse()
      )
}

describe("the new wholesaler's form", () => {
  it("needs an address, a contact and a price source", () => {
    expect(issues(blankAccount)).toMatchObject({
      email: `${E}.emailRequired`,
      contact_name: `${E}.contact`,
      tier_id: `${E}.priceSource`,
    })
    expect(issues(valid)).toEqual({})
    // Own prices alone are a price source too
    expect(issues({ ...valid, tier_id: "", own_prices: true })).toEqual({})
  })

  it("takes the tax office and number together, and a company with them", () => {
    expect(issues({ ...valid, tax_office: "Kadıköy" })).toEqual({ tax_id: `${E}.taxPair` })
    expect(issues({ ...valid, tax_id: "1234567890" })).toMatchObject({
      tax_office: `${E}.taxPair`,
      company_name: `${E}.companyForTax`,
    })
    expect(issues({ ...valid, tax_office: "Kadıköy", tax_id: "12345" })).toMatchObject({
      tax_id: `${E}.taxId`,
    })
    expect(
      issues({
        ...valid,
        company_name: "Kaya Bıçak",
        tax_office: "Kadıköy",
        tax_id: "123 456 7890",
      })
    ).toEqual({})
  })

  it("checks the own rate only while own prices are on", () => {
    expect(issues({ ...valid, own_prices: true, percent: "120" })).toEqual({
      percent: `${E}.percent`,
    })
    expect(issues({ ...valid, own_prices: false, percent: "120" })).toEqual({})
    expect(issues({ ...valid, min_quantity: "0" })).toEqual({ min_quantity: `${E}.minimum` })
  })

  it("sends the address in lower case, the tax number's digits and the rate as a number", () => {
    expect(
      createBodyOf({
        ...valid,
        company_name: "Kaya Bıçak",
        tax_office: "Kadıköy",
        tax_id: "123 456 7890",
        own_prices: true,
        percent: "12,5",
        min_quantity: "1.000",
      })
    ).toEqual({
      email: "satinalma@kayabicak.com.tr",
      contact_name: "Ali Kaya",
      company_name: "Kaya Bıçak",
      tax_office: "Kadıköy",
      tax_id: "1234567890",
      tier_id: "wst_1",
      own_prices: true,
      percent: 12.5,
      min_quantity: 1000,
    })
    // A rate typed and then hidden (own prices turned off) is not sent
    expect(createBodyOf({ ...valid, percent: "10" })).toMatchObject({
      own_prices: false,
      percent: null,
      company_name: null,
      min_quantity: null,
    })
  })
})

describe("the wholesaler's edit window", () => {
  it("sends only what changed, a cleared value as null", () => {
    const before = editValuesOf(account({ own_prices: true, percent: 10, min_quantity: 5 }))
    expect(updateBodyOf(before, before)).toEqual({})
    expect(
      updateBodyOf(
        { ...before, tier_id: "", percent: "", min_quantity: "", company_name: "Kaya A.Ş." },
        before
      )
    ).toEqual({ tier_id: null, percent: null, min_quantity: null, company_name: "Kaya A.Ş." })
  })

  it("opens the own list once, never closes it", () => {
    const before = editValuesOf(account())
    expect(updateBodyOf({ ...before, own_prices: true, percent: "7,5" }, before)).toEqual({
      own_prices: true,
      percent: 7.5,
    })
  })

  it("keeps a price source", () => {
    const values = { ...editValuesOf(account()), tier_id: "" }
    expect(editSchema.safeParse(values).success).toBe(false)
    expect(editSchema.safeParse({ ...values, own_prices: true }).success).toBe(true)
  })
})

describe("a level's window", () => {
  it("reads the rate and minimum the Turkish way", () => {
    expect(tierBodyOf({ name: " Toptan A ", percent: "15,25", min_quantity: "" })).toEqual({
      name: "Toptan A",
      percent: 15.25,
      min_quantity: null,
    })
    expect(minimumOf("12")).toBe(12)
    expect(minimumOf("2,5")).toBeNull()
    expect(minimumOf("100001")).toBeNull()
  })
})
