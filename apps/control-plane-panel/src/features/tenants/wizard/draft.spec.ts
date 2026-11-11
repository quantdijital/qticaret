import { describe, expect, it } from "vitest"
import { isPhone, isValidTckn, isValidVkn } from "@/features/tenants/company-rules"
import {
  emptyDraft,
  firstStepWithProblems,
  isDirty,
  missingCompanyFields,
  stepProblems,
} from "./draft"
import type { AddressChecks, ShopDraft } from "./draft"
import { filledDraft } from "@/test/wizard"

const NO_CHECKS: AddressChecks = { slug: null, hostname: null }

const freeAddress = (slug: string, hostname: string | null = null): AddressChecks => ({
  slug: { value: slug, problem: null },
  hostname: hostname === null ? null : { value: hostname, problem: null },
})

describe("the wizard's checks before Next (C11)", () => {
  it("asks the shop's name and checks the numbers' check digits, blank ones allowed", () => {
    const draft = emptyDraft()
    expect(stepProblems("company", draft, NO_CHECKS)).toEqual({ name: "wizard.errors.shopName" })

    const wrong: ShopDraft = {
      ...draft,
      name: "Kalem",
      company: { ...draft.company, tax_number: "1234567891", postal_code: "341" },
    }
    expect(stepProblems("company", wrong, NO_CHECKS)).toEqual({
      "company.tax_number": "company.invalid.tax_number",
      "company.postal_code": "company.invalid.postal_code",
    })

    const sole: ShopDraft = {
      ...wrong,
      company: { ...wrong.company, kind: "sole_proprietor", tckn: "10000000147", postal_code: "" },
    }
    // A sole proprietor's TCKN counts, the company's VKN field no longer does
    expect(stepProblems("company", sole, NO_CHECKS)).toEqual({
      "company.tckn": "company.invalid.tckn",
    })
    expect(stepProblems("company", filledDraft(), NO_CHECKS)).toEqual({})
  })

  it("asks the owner's name and e-mail; a billing or technical contact only when added", () => {
    const draft = emptyDraft()
    expect(stepProblems("contacts", draft, NO_CHECKS)).toEqual({
      "owner.name": "wizard.errors.personName",
      "owner.email": "wizard.errors.emailRequired",
    })

    const filled = filledDraft()
    const typed: ShopDraft = {
      ...filled,
      owner: { ...filled.owner, email: "ayse@", phone: "12" },
      billing: { name: "", email: "", phone: "", enabled: true },
    }
    expect(stepProblems("contacts", typed, NO_CHECKS)).toEqual({
      "owner.email": "errors.cp.email_invalid",
      "owner.phone": "errors.cp.phone_invalid",
      "billing.name": "wizard.errors.personName",
      "billing.email": "wizard.errors.emailRequired",
    })
    expect(stepProblems("contacts", filledDraft(), NO_CHECKS)).toEqual({})
  })

  it("asks a package", () => {
    expect(stepProblems("package", emptyDraft(), NO_CHECKS)).toEqual({
      package_id: "wizard.errors.packageRequired",
    })
    expect(stepProblems("package", filledDraft(), NO_CHECKS)).toEqual({})
  })

  it("passes an address only as the control plane answered for it", () => {
    const draft = filledDraft()
    expect(stepProblems("address", draft, NO_CHECKS)).toEqual({ slug: "wizard.address.checking" })
    // An answer for an older value does not count
    expect(stepProblems("address", draft, freeAddress("bicak"))).toEqual({
      slug: "wizard.address.checking",
    })
    expect(stepProblems("address", draft, freeAddress("bicak-atolyesi"))).toEqual({})
    expect(
      stepProblems("address", draft, {
        slug: { value: "bicak-atolyesi", problem: "cp.slug_taken" },
        hostname: null,
      })
    ).toEqual({ slug: "errors.cp.slug_taken" })
    expect(stepProblems("address", { ...draft, typed_slug: "1-bicak" }, NO_CHECKS)).toEqual({
      slug: "tenants.create.slugInvalid",
    })
    expect(stepProblems("address", { ...draft, name: "", typed_slug: null }, NO_CHECKS)).toEqual({
      slug: "wizard.errors.slugRequired",
    })
  })

  it("checks an own domain only when one is typed, as the control plane keeps it", () => {
    const draft = { ...filledDraft(), custom_domain: " Bicak.com. " }
    expect(stepProblems("address", draft, freeAddress("bicak-atolyesi"))).toEqual({
      custom_domain: "wizard.address.checking",
    })
    expect(stepProblems("address", draft, freeAddress("bicak-atolyesi", "bicak.com"))).toEqual({})
    expect(
      stepProblems("address", draft, {
        slug: { value: "bicak-atolyesi", problem: null },
        hostname: { value: "bicak.com", problem: "cp.domain_taken" },
      })
    ).toEqual({ custom_domain: "errors.cp.domain_taken" })
  })

  it("finds the first step to fix and the invoice fields left blank (a warning)", () => {
    const draft = filledDraft()
    expect(firstStepWithProblems(emptyDraft(), NO_CHECKS)).toBe(0)
    expect(firstStepWithProblems({ ...draft, package_id: "" }, NO_CHECKS)).toBe(2)
    expect(firstStepWithProblems(draft, NO_CHECKS)).toBe(3)
    expect(firstStepWithProblems(draft, freeAddress("bicak-atolyesi"))).toBe(-1)
    expect(missingCompanyFields(draft.company)).toEqual(["tax_office", "address_line", "city"])
  })

  it("knows when something was typed", () => {
    expect(isDirty(emptyDraft())).toBe(false)
    expect(isDirty({ ...emptyDraft(), name: "K" })).toBe(true)
  })
})

describe("the company's checks (shared with the company dialog)", () => {
  it("applies the official check digits", () => {
    expect(isValidVkn("1234567890")).toBe(true)
    expect(isValidVkn("1234567891")).toBe(false)
    expect(isValidTckn("10000000146")).toBe(true)
    expect(isValidTckn("10000000147")).toBe(false)
    expect(isValidTckn("01234567890")).toBe(false)
  })

  it("reads phones as the control plane does", () => {
    for (const phone of [
      "0532 123 45 67",
      "+90 532 123 4567",
      "(0212) 555 12 12",
      "+49 30 1234567",
    ]) {
      expect(isPhone(phone)).toBe(true)
    }
    for (const phone of ["12", "0132 123 45 67", "+90 132 123 4567", "abc"]) {
      expect(isPhone(phone)).toBe(false)
    }
  })
})
