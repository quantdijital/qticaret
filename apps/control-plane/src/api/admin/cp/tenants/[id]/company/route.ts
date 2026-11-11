import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { sealTckn } from "../../../../../../lib/tenants/tckn"
import type { CompanyFields } from "../../../../../../modules/tenants/types"
import { saveCompanyWorkflow } from "../../../../../../workflows/tenants/tenant-profile"
import { noteAuditChanges } from "../../../../../http/audit"
import { tenantParam, tenantsOf } from "../../params"
import type { PostCompanyType } from "../../validators"
import { companyView } from "../../views"

/**
 * The fields to write: given ones as given; a TCKN sealed here, before any
 * workflow sees it (adr/0061 §4.3), and only for a sole proprietor; a
 * company keeps none (`cp.tckn_company` when one is sent).
 */
async function fieldsOf(
  tenantId: string,
  body: PostCompanyType,
  kindBefore: CompanyFields["kind"] | undefined
): Promise<Partial<CompanyFields>> {
  const { tckn, ...rest } = body
  const kind = body.kind ?? kindBefore ?? "company"
  if (kind === "company" && typeof tckn === "string") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.tckn_company")
  }
  const fields: Partial<CompanyFields> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  )
  if (kind === "company" || tckn === null) {
    return { ...fields, tckn_sealed: null, tckn_last4: null }
  }
  return typeof tckn === "string" ? { ...fields, ...(await sealTckn(tenantId, tckn)) } : fields
}

/**
 * POST /admin/cp/tenants/:id/company (owner, operator, finance): the
 * shop's company, the invoice's addressee: given fields set, blank ones
 * cleared, absent ones kept. Recorded by field names; the TCKN's change
 * by a mark only, never its value.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostCompanyType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const before = await tenantsOf(req).companyOf(tenant.id)
  const fields = await fieldsOf(tenant.id, req.validatedBody, before?.kind)
  await saveCompanyWorkflow(req.scope).run({ input: { tenant_id: tenant.id, fields } })
  const tcknChanged =
    "tckn_sealed" in fields &&
    (fields.tckn_sealed !== null || (before?.tckn_sealed ?? null) !== null)
  noteAuditChanges(req, {
    ...(fields.kind && fields.kind !== before?.kind
      ? { kind: { from: before?.kind ?? null, to: fields.kind } }
      : {}),
    ...(tcknChanged ? { tckn: { changed: true } } : {}),
  })
  res.json({ company: companyView(await tenantsOf(req).companyOf(tenant.id)) })
}
