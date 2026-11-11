import { z } from "zod"
import type { CompanyKind } from "@/features/tenants/api"
import { companyFieldWrong, isPhone } from "@/features/tenants/company-rules"
import { SLUG_PATTERN, slugFromName } from "@/features/tenants/slug"

/**
 * A new shop as the wizard holds it (C11) until "Kur": in this page's
 * memory only, never in the browser's storage (the TCKN is in it). Each
 * step's problems are worked out from it, so going back and forth keeps
 * everything typed and Next says what is missing where it is.
 */

export const WIZARD_STEPS = [
  "company",
  "contacts",
  "package",
  "address",
  "sector",
  "review",
] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export interface PersonDraft {
  name: string
  email: string
  phone: string
}

export interface ExtraPersonDraft extends PersonDraft {
  /** Asked for: the fields are shown and needed. */
  enabled: boolean
}

export interface CompanyDraft {
  kind: CompanyKind
  legal_name: string
  tax_office: string
  tax_number: string
  /** Sent once with the company; never read back or shown again. */
  tckn: string
  address_line: string
  district: string
  city: string
  postal_code: string
}

export interface ShopDraft {
  name: string
  company: CompanyDraft
  owner: PersonDraft
  billing: ExtraPersonDraft
  technical: ExtraPersonDraft
  package_id: string
  /** Null: suggested from the name until typed. */
  typed_slug: string | null
  custom_domain: string
  /** A pack's code (C12: whatever the control plane offers; the general one first). */
  sector_pack: string
}

const person = (): PersonDraft => ({ name: "", email: "", phone: "" })

export const emptyDraft = (): ShopDraft => ({
  name: "",
  company: {
    kind: "company",
    legal_name: "",
    tax_office: "",
    tax_number: "",
    tckn: "",
    address_line: "",
    district: "",
    city: "",
    postal_code: "",
  },
  owner: person(),
  billing: { ...person(), enabled: false },
  technical: { ...person(), enabled: false },
  package_id: "",
  typed_slug: null,
  custom_domain: "",
  sector_pack: "general",
})

/** The slug the shop gets: the typed one, else the name's. */
export const slugOf = (draft: ShopDraft): string => draft.typed_slug ?? slugFromName(draft.name)

/** The own domain as the control plane keeps it: lower case, no trailing dot; "" for none. */
export const domainOf = (draft: ShopDraft): string =>
  draft.custom_domain.trim().toLowerCase().replace(/\.$/, "")

/** Whether anything was typed: leaving then asks first. */
export const isDirty = (draft: ShopDraft): boolean =>
  JSON.stringify(draft) !== JSON.stringify(emptyDraft())

/** What the control plane said of the address (`GET /admin/cp/tenant-availability`). */
export interface AddressCheck {
  /** The slug or host name the answer is for; an answer for an older value is not used. */
  value: string
  problem: string | null
}

export interface AddressChecks {
  slug: AddressCheck | null
  hostname: AddressCheck | null
}

/** A field's path (`owner.email`) and the text key that says what is wrong. */
export type Problems = Record<string, string>

const EMAIL = z.email()
const NAME_MAX = 100

function personProblems(prefix: string, who: PersonDraft, problems: Problems) {
  if (who.name.trim() === "") {
    problems[`${prefix}.name`] = "wizard.errors.personName"
  } else if (who.name.trim().length > NAME_MAX) {
    problems[`${prefix}.name`] = "wizard.errors.tooLong"
  }
  if (who.email.trim() === "") {
    problems[`${prefix}.email`] = "wizard.errors.emailRequired"
  } else if (!EMAIL.safeParse(who.email.trim()).success) {
    problems[`${prefix}.email`] = "errors.cp.email_invalid"
  }
  if (who.phone.trim() !== "" && !isPhone(who.phone)) {
    problems[`${prefix}.phone`] = "errors.cp.phone_invalid"
  }
}

function companyProblems(draft: ShopDraft, problems: Problems) {
  const name = draft.name.trim()
  if (name === "") {
    problems["name"] = "wizard.errors.shopName"
  } else if (name.length > NAME_MAX) {
    problems["name"] = "wizard.errors.tooLong"
  }
  const { company } = draft
  const number = company.kind === "company" ? "tax_number" : "tckn"
  for (const field of [number, "postal_code"] as const) {
    if (companyFieldWrong(field, company[field])) {
      problems[`company.${field}`] = `company.invalid.${field}`
    }
  }
  for (const [field, max] of [
    ["legal_name", 200],
    ["tax_office", 100],
    ["address_line", 300],
    ["district", 100],
    ["city", 100],
  ] as const) {
    if (company[field].trim().length > max) {
      problems[`company.${field}`] = "wizard.errors.tooLong"
    }
  }
}

function addressProblems(draft: ShopDraft, checks: AddressChecks, problems: Problems) {
  const slug = slugOf(draft)
  if (!SLUG_PATTERN.test(slug)) {
    problems["slug"] = slug === "" ? "wizard.errors.slugRequired" : "tenants.create.slugInvalid"
  } else if (checks.slug?.value !== slug) {
    problems["slug"] = "wizard.address.checking"
  } else if (checks.slug.problem) {
    problems["slug"] = `errors.${checks.slug.problem}`
  }
  const domain = domainOf(draft)
  if (domain === "") {
    return
  }
  if (checks.hostname?.value !== domain) {
    problems["custom_domain"] = "wizard.address.checking"
  } else if (checks.hostname.problem) {
    problems["custom_domain"] = `errors.${checks.hostname.problem}`
  }
}

/**
 * What stops a step from going on, by field: required fields, formats,
 * and for the address what the control plane said (a check still on its
 * way stops it too, so Next never passes an unchecked address).
 */
export function stepProblems(step: WizardStep, draft: ShopDraft, checks: AddressChecks): Problems {
  const problems: Problems = {}
  switch (step) {
    case "company":
      companyProblems(draft, problems)
      break
    case "contacts":
      personProblems("owner", draft.owner, problems)
      for (const extra of ["billing", "technical"] as const) {
        if (draft[extra].enabled) {
          personProblems(extra, draft[extra], problems)
        }
      }
      break
    case "package":
      if (draft.package_id === "") {
        problems["package_id"] = "wizard.errors.packageRequired"
      }
      break
    case "address":
      addressProblems(draft, checks, problems)
      break
    case "sector":
    case "review":
      break
  }
  return problems
}

/** The first step with a problem (the review sends the person there), or -1. */
export const firstStepWithProblems = (draft: ShopDraft, checks: AddressChecks): number =>
  WIZARD_STEPS.findIndex((step) => Object.keys(stepProblems(step, draft, checks)).length > 0)

/** The invoice fields left blank: said on the review, never refused (the shop's page says it too). */
export function missingCompanyFields(company: CompanyDraft): string[] {
  const number = company.kind === "company" ? "tax_number" : "tckn"
  return (["legal_name", "tax_office", number, "address_line", "city"] as const).filter(
    (field) => company[field].trim() === ""
  )
}
