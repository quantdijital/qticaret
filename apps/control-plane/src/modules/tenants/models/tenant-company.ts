import { model } from "@medusajs/framework/utils"
import { COMPANY_KINDS } from "../../../lib/tenants/kinds"
import { Tenant } from "./tenant"

/**
 * Who the shop is on paper (adr/0061 §2): the invoice's addressee. A
 * company has a VKN; a sole proprietor is invoiced by their TCKN, which is
 * personal data: kept sealed (envelope, `CP_MASTER_KEY`, bound to the
 * tenant), shown masked by its last four digits; reading it takes a
 * step-up and is audited first. Any field may be blank while it is not
 * known yet: the panel warns, nothing refuses.
 */
export const TenantCompany = model
  .define("tenant_company", {
    id: model.id({ prefix: "tenco" }).primaryKey(),
    kind: model.enum([...COMPANY_KINDS]).default("company"),
    legal_name: model.text().nullable(),
    tax_office: model.text().nullable(),
    /** VKN, 10 digits with its check digit. */
    tax_number: model.text().nullable(),
    /** The sole proprietor's TCKN, sealed (`qtenv1.…`); never in the clear at rest. */
    tckn_sealed: model.text().nullable(),
    tckn_last4: model.text().nullable(),
    address_line: model.text().nullable(),
    district: model.text().nullable(),
    city: model.text().nullable(),
    postal_code: model.text().nullable(),
    country_code: model.text().default("TR"),
    tenant: model.belongsTo(() => Tenant, { mappedBy: "company" }),
  })
  .indexes([{ on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" }])
