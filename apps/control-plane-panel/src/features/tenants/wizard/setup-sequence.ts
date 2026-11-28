import type { ContactInput, CompanyInput, NewTenant } from "@/features/tenants/mutations"
import { compact } from "@/features/tenants/company-rules"
import type { ShopDraft } from "./draft"
import { domainOf, missingCompanyFields, slugOf } from "./draft"

/**
 * "Kur" (C11): the record first (C7's workflow, behind a step-up), then
 * its company, its contacts and its own domain, one save each, in order,
 * then the setup (C10, behind the same proof: the step-up holds it five
 * minutes). The policy when a save fails after the record exists (adr/0061
 * Ek C11): the record stays, the other saves still go, and the setup is
 * not started, so no shop is brought up half filled in without anyone
 * deciding it. The wizard says which part failed and offers to try those
 * again, or to go on from the shop's page (its warnings and its "Kurulum"
 * tab). Running it again does only what is not done yet.
 */

export const SETUP_PARTS = [
  "record",
  "company",
  "owner",
  "billing",
  "technical",
  "domain",
  "provisioning",
] as const
export type SetupPart = (typeof SETUP_PARTS)[number]

export type PartState = "waiting" | "running" | "done" | "failed" | "skipped"

export interface PartProgress {
  state: PartState
  error?: unknown
}

export interface SetupProgress {
  /** The record once made: from then on the wizard cannot change it. */
  tenantId: string | null
  parts: Record<SetupPart, PartProgress>
}

/** The calls it makes; the page gives the real ones, a test its own. */
export interface SetupCalls {
  createTenant: (input: NewTenant & { sector_pack: string }) => Promise<{ id: string }>
  saveCompany: (tenantId: string, input: CompanyInput) => Promise<unknown>
  saveContact: (tenantId: string, input: ContactInput) => Promise<unknown>
  addDomain: (tenantId: string, hostname: string) => Promise<unknown>
  startProvisioning: (tenantId: string) => Promise<unknown>
}

/** Whether the company has anything worth saving beyond its kind. */
const hasCompany = (draft: ShopDraft) =>
  draft.company.kind !== "company" ||
  missingCompanyFields(draft.company).length < 5 ||
  draft.company.district.trim() !== "" ||
  draft.company.postal_code.trim() !== ""

/** The parts this shop has: the optional ones skipped when not asked for. */
export function plannedProgress(draft: ShopDraft): SetupProgress {
  const planned: Record<SetupPart, boolean> = {
    record: true,
    company: hasCompany(draft),
    owner: true,
    billing: draft.billing.enabled,
    technical: draft.technical.enabled,
    domain: draft.custom_domain.trim() !== "",
    provisioning: true,
  }
  return {
    tenantId: null,
    parts: Object.fromEntries(
      SETUP_PARTS.map((part) => [part, { state: planned[part] ? "waiting" : "skipped" }])
    ) as Record<SetupPart, PartProgress>,
  }
}

export function companyInput(draft: ShopDraft): CompanyInput {
  const { kind, tckn, ...rest } = draft.company
  const sole = kind === "sole_proprietor"
  return {
    kind,
    legal_name: rest.legal_name.trim(),
    tax_office: rest.tax_office.trim(),
    tax_number: sole ? "" : compact(rest.tax_number),
    ...(sole && tckn.trim() !== "" ? { tckn: compact(tckn) } : {}),
    address_line: rest.address_line.trim(),
    district: rest.district.trim(),
    city: rest.city.trim(),
    postal_code: compact(rest.postal_code),
  }
}

const contactInput = (
  role: "owner" | "billing" | "technical",
  who: { name: string; email: string; phone: string },
  primaryBilling: boolean
): ContactInput => ({
  name: who.name.trim(),
  role,
  email: who.email.trim(),
  phone: who.phone.trim(),
  is_primary_billing: primaryBilling,
})

const settled = (progress: SetupProgress, part: SetupPart) =>
  progress.parts[part].state === "done" || progress.parts[part].state === "skipped"

/** Whether every part is done (or not asked for): the shop's page opens on its setup. */
export const isComplete = (progress: SetupProgress) =>
  SETUP_PARTS.every((part) => settled(progress, part))

/** The parts that failed, in order. */
export const failedParts = (progress: SetupProgress) =>
  SETUP_PARTS.filter((part) => progress.parts[part].state === "failed")

/**
 * Runs what is not done yet, telling `onChange` after each part; returns
 * where it ended. A record that could not be made stops everything: there
 * is nothing to save to and nothing was made.
 */
export async function runSetup(
  draft: ShopDraft,
  calls: SetupCalls,
  start: SetupProgress,
  onChange: (progress: SetupProgress) => void
): Promise<SetupProgress> {
  let progress: SetupProgress = { tenantId: start.tenantId, parts: { ...start.parts } }
  const mark = (part: SetupPart, next: PartProgress) => {
    progress = { ...progress, parts: { ...progress.parts, [part]: next } }
    onChange(progress)
  }
  const attempt = async (part: SetupPart, call: () => Promise<unknown>) => {
    if (settled(progress, part)) {
      return
    }
    mark(part, { state: "running" })
    try {
      await call()
      mark(part, { state: "done" })
    } catch (error) {
      mark(part, { state: "failed", error })
    }
  }

  if (!progress.tenantId) {
    mark("record", { state: "running" })
    try {
      const made = await calls.createTenant({
        name: draft.name.trim(),
        slug: slugOf(draft),
        package_id: draft.package_id,
        sector_pack: draft.sector_pack,
        // "": the pack's first look, the control plane's default
        ...(draft.preset !== "" ? { preset: draft.preset } : {}),
        storefront_contact: draft.storefront_contact,
      })
      progress = { ...progress, tenantId: made.id }
      mark("record", { state: "done" })
    } catch (error) {
      mark("record", { state: "failed", error })
      return progress
    }
  }
  const id = progress.tenantId
  if (!id) {
    return progress
  }
  // A separate billing contact takes the reminders; otherwise the owner, the first, has them
  const billing = draft.billing.enabled
  await attempt("company", () => calls.saveCompany(id, companyInput(draft)))
  await attempt("owner", () => calls.saveContact(id, contactInput("owner", draft.owner, !billing)))
  await attempt("billing", () =>
    calls.saveContact(id, contactInput("billing", draft.billing, true))
  )
  await attempt("technical", () =>
    calls.saveContact(id, contactInput("technical", draft.technical, false))
  )
  await attempt("domain", () => calls.addDomain(id, domainOf(draft)))
  // Policy: no setup on a half-saved shop; the person decides from here
  if (failedParts(progress).length === 0) {
    await attempt("provisioning", () => calls.startProvisioning(id))
  }
  return progress
}
