import { model } from "@medusajs/framework/utils"
import { TENANT_STATUSES } from "@qticaret/types/control-plane"
import { TenantCompany } from "./tenant-company"
import { TenantContact } from "./tenant-contact"
import { TenantDomain } from "./tenant-domain"
import { TenantNote } from "./tenant-note"
import { TenantStatusChange } from "./tenant-status-change"

/**
 * A shop the platform runs (adr/0061 §2): its slug (fixed once made: its
 * database, its subdomain and its documents are named after it), the name
 * staff know it by, and where it stands in its lifecycle. A record made in
 * C7 waits in `provisioning` until the setup (C10) brings it up.
 */
export const Tenant = model
  .define("tenant", {
    id: model.id({ prefix: "ten" }).primaryKey(),
    slug: model.text(),
    name: model.text(),
    status: model.enum([...TENANT_STATUSES]).default("provisioning"),
    status_changed_at: model.dateTime(),
    /** The sector pack it is set up with (C11 wizard, C12); none: the general pack. */
    sector_pack: model.text().nullable(),
    /**
     * The pack's version the shop last applied and when (C12, from the
     * shop's `tenant:apply-pack` result); null until it has.
     */
    sector_pack_version: model.number().nullable(),
    sector_pack_applied_at: model.dateTime().nullable(),
    /**
     * The ready-made look it is set up with (adr/0063 §7, task 2.7): a code
     * of its sector pack's looks, chosen in the wizard; none: no look is
     * applied. Its version and when the shop applied it are kept from the
     * shop's `tenant:apply-preset` result; null until it has. Once applied,
     * a setup run again leaves the shop's design alone.
     */
    preset: model.text().nullable(),
    preset_version: model.number().nullable(),
    preset_applied_at: model.dateTime().nullable(),
    /** The staff member who made the record; null for the system (a script). */
    created_by: model.text().nullable(),
    /**
     * The shop backend's internal base URL (Ek C9): where its plan document
     * is pushed. Set by the provisioner (C10), in development by `cp:fleet`;
     * null: nothing is pushed, the shop pulls.
     */
    api_base_url: model.text().nullable(),
    /**
     * The shop's storefront home page (Ek C13): what the health probe asks
     * for besides the backend's `/health`. Deployed, one of its verified
     * domains (`https`); in development `cp:fleet set-storefront-url`. Null:
     * not probed (a local shop has no storefront).
     */
    storefront_url: model.text().nullable(),
    company: model.hasOne(() => TenantCompany, { mappedBy: "tenant" }),
    contacts: model.hasMany(() => TenantContact, { mappedBy: "tenant" }),
    domains: model.hasMany(() => TenantDomain, { mappedBy: "tenant" }),
    status_changes: model.hasMany(() => TenantStatusChange, { mappedBy: "tenant" }),
    notes: model.hasMany(() => TenantNote, { mappedBy: "tenant" }),
  })
  .indexes([
    { on: ["slug"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
    { on: ["created_at"], where: "deleted_at IS NULL" },
  ])
  .cascades({ delete: ["company", "contacts", "domains", "status_changes", "notes"] })
