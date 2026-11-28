import { model } from "@medusajs/framework/utils"
import { DOMAIN_CHECK_ERRORS, DOMAIN_KINDS, DOMAIN_VERIFICATIONS } from "../../../lib/tenants/kinds"
import { Tenant } from "./tenant"

/**
 * A host name the shop answers on (adr/0061 §2): its subdomain under
 * `PLATFORM_DOMAIN`, made with the record and verified by definition, and
 * the shop's own domains, proved by a TXT record carrying their token
 * (F16.7, lib/domains). One is primary: the storefront's canonical address.
 */
export const TenantDomain = model
  .define("tenant_domain", {
    id: model.id({ prefix: "tendm" }).primaryKey(),
    hostname: model.text(),
    kind: model.enum([...DOMAIN_KINDS]),
    verification: model.enum([...DOMAIN_VERIFICATIONS]).default("pending"),
    is_primary: model.boolean().default(false),
    /** Published by the shop as `_qticaret-verify.<host>` TXT; not a secret. Null on the subdomain. */
    verification_token: model.text().nullable(),
    verification_error: model.enum([...DOMAIN_CHECK_ERRORS]).nullable(),
    verified_at: model.dateTime().nullable(),
    /** Since when a proved domain's TXT proof has been missing (F16.7 review M1). */
    txt_lost_since: model.dateTime().nullable(),
    last_checked_at: model.dateTime().nullable(),
    /** When the job checks it again; null: not again (failed, or the subdomain). */
    next_check_at: model.dateTime().nullable(),
    check_attempts: model.number().default(0),
    tenant: model.belongsTo(() => Tenant, { mappedBy: "domains" }),
  })
  .indexes([
    { on: ["hostname"], unique: true, where: "deleted_at IS NULL" },
    { on: ["tenant_id"], where: "deleted_at IS NULL" },
    {
      name: "IDX_tenant_domain_next_check_at",
      on: ["next_check_at"],
      where: "next_check_at IS NOT NULL AND deleted_at IS NULL",
    },
    {
      name: "IDX_tenant_domain_primary",
      on: ["tenant_id"],
      unique: true,
      where: "is_primary = true AND deleted_at IS NULL",
    },
  ])
