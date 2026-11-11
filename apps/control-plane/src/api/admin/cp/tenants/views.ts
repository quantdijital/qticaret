import type { MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { platformFlags } from "@qticaret/types/control-plane"
import { effectiveFlags } from "../../../../lib/fleet/plan-content"
import { effectiveLimits } from "../../../../lib/plans/limits"
import { fleetIn } from "../../../../workflows/modules"
import { omit } from "../../../../lib/omit"
import { maskEmail, maskPhone } from "../../../../lib/tenants/mask"
import { maskedTckn } from "../../../../lib/tenants/tckn"
import type { CompanyRecord, NoteRecord, TenantRecord } from "../../../../modules/tenants/types"
import { NOTE_FIELDS } from "../../../../modules/tenants/types"
import { plansOf, tenantsOf } from "./params"

/** Staff members' names by user id (a note's author, an activity's actor); the address if unnamed. */
export async function staffNames(
  req: MedusaRequest,
  ids: readonly (string | null)[]
): Promise<Record<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))]
  if (wanted.length === 0) {
    return {}
  }
  const users = await req.scope
    .resolve(Modules.USER)
    .listUsers(
      { id: wanted },
      { select: ["id", "first_name", "last_name", "email"], take: wanted.length }
    )
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
    ])
  )
}

/** A row without its shop: the ORM adds the relation (`tenant: { id }`) beside `tenant_id`. */
const bare = <T extends object>(row: T) => omit(row, "tenant_id", "tenant")

/** The company as staff see it: the TCKN masked, never sealed or in the clear. */
export function companyView(company: CompanyRecord | null) {
  if (!company) {
    return null
  }
  const { tckn_sealed, tckn_last4, ...fields } = bare(company)
  return { ...fields, tckn_masked: tckn_sealed ? maskedTckn(tckn_last4) : null }
}

async function notesOf(req: MedusaRequest, tenantId: string) {
  const notes = (await tenantsOf(req).listTenantNotes(
    { tenant_id: tenantId },
    { select: [...NOTE_FIELDS], order: { created_at: "DESC" }, take: 200 }
  )) as unknown as NoteRecord[]
  // Pinned first, newest first within each
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned))
}

/** A shop in full (GET /admin/cp/tenants/:id): every part the detail page shows. */
export async function tenantDetail(
  req: MedusaRequest,
  tenant: TenantRecord,
  options: { maskContacts: boolean; fleet: boolean }
) {
  const service = tenantsOf(req)
  const plans = plansOf(req)
  const [company, contacts, domains, notes, plan, overrides, flagOverrides, document] =
    await Promise.all([
      service.companyOf(tenant.id),
      service.contactsOf(tenant.id),
      service.domainsOf(tenant.id),
      notesOf(req, tenant.id),
      plans.planOf(tenant.id),
      plans.overridesOf(tenant.id),
      plans.featureOverridesOf(tenant.id),
      options.fleet ? fleetIn(req.scope).planDocumentSummary(tenant.id) : null,
    ])
  const names = await staffNames(req, [
    tenant.created_by,
    ...notes.map((note) => note.author_id),
    ...overrides.map((each) => each.created_by),
    ...flagOverrides.map((each) => each.created_by),
  ])
  const nodeEnv = process.env["NODE_ENV"]
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status,
      status_changed_at: tenant.status_changed_at,
      sector_pack: tenant.sector_pack,
      created_at: tenant.created_at,
      created_by: tenant.created_by ? (names[tenant.created_by] ?? null) : null,
      // The subscription's next due date arrives with billing (C16)
      next_payment_on: null,
    },
    company: companyView(company),
    contacts: contacts.map((contact) =>
      options.maskContacts
        ? {
            ...bare(contact),
            email: maskEmail(contact.email),
            phone: contact.phone ? maskPhone(contact.phone) : null,
          }
        : bare(contact)
    ),
    domains: domains.map(bare),
    notes: notes.map((note) => ({
      ...bare(note),
      author: note.author_id ? (names[note.author_id] ?? null) : null,
    })),
    package: plan,
    overrides: overrides.map((each) => ({
      ...bare(each),
      created_by: each.created_by ? (names[each.created_by] ?? null) : null,
    })),
    limits: effectiveLimits(plan?.limits ?? null, overrides),
    // Ek C9: the platform flags as the shop's document carries them, and its exceptions
    platform_flags: platformFlags(nodeEnv).map(({ key, default: value }) => ({
      key,
      default: value,
    })),
    feature_overrides: flagOverrides.map((each) => ({
      ...bare(each),
      created_by: each.created_by ? (names[each.created_by] ?? null) : null,
    })),
    features: effectiveFlags(plan?.features ?? null, flagOverrides, new Date(), nodeEnv),
    // What the shop was last told and whether it took it: the roles that run shops only
    plan_document: options.fleet
      ? { ...document, issued: document !== null, push_target: tenant.api_base_url }
      : undefined,
  }
}
