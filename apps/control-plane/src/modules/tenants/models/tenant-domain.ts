import { model } from "@medusajs/framework/utils"
import { DOMAIN_KINDS, DOMAIN_VERIFICATIONS } from "../../../lib/tenants/kinds"
import { Tenant } from "./tenant"

/**
 * A host name the shop answers on (adr/0061 §2): its subdomain under
 * `PLATFORM_DOMAIN`, made with the record and verified by definition, and
 * the shop's own domains, waiting for their verification (F16.7). One is
 * primary: the storefront's canonical address.
 */
export const TenantDomain = model
  .define("tenant_domain", {
    id: model.id({ prefix: "tendm" }).primaryKey(),
    hostname: model.text(),
    kind: model.enum([...DOMAIN_KINDS]),
    verification: model.enum([...DOMAIN_VERIFICATIONS]).default("pending"),
    is_primary: model.boolean().default(false),
    tenant: model.belongsTo(() => Tenant, { mappedBy: "domains" }),
  })
  .indexes([
    { on: ["hostname"], unique: true, where: "deleted_at IS NULL" },
    { on: ["tenant_id"], where: "deleted_at IS NULL" },
    {
      name: "IDX_tenant_domain_primary",
      on: ["tenant_id"],
      unique: true,
      where: "is_primary = true AND deleted_at IS NULL",
    },
  ])
