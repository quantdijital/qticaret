import { model } from "@medusajs/framework/utils"

/**
 * A shop's Ed25519 public key (adr/0061 §2 `fleet`, §3.2): what the shop's
 * signed requests are checked against. The private half is the shop's
 * alone (`TENANT_SIGNING_KEY`): made once, handed to the provisioner,
 * never kept here. `next` while a `rotate_keys` run moves the shop to a
 * new pair; the old one `retired` after it.
 */
export const TENANT_KEY_STATUSES = ["active", "next", "retired"] as const
export type TenantKeyStatus = (typeof TENANT_KEY_STATUSES)[number]

export const TenantKey = model
  .define("tenant_key", {
    id: model.id({ prefix: "tenkey" }).primaryKey(),
    tenant_id: model.text(),
    kid: model.text(),
    /** The raw 32-byte public key, base64url. */
    public_key: model.text(),
    status: model.enum([...TENANT_KEY_STATUSES]),
    retired_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["kid"], unique: true },
    { on: ["tenant_id"], where: "deleted_at IS NULL" },
    ...(["active", "next"] as const).map((status) => ({
      name: `IDX_tenant_key_one_${status}`,
      on: ["tenant_id" as const],
      unique: true,
      where: `status = '${status}' AND deleted_at IS NULL`,
    })),
  ])
