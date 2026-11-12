import { model } from "@medusajs/framework/utils"

/**
 * A release the platform knows (adr/0061 §2 `fleet` `release`, F17.5, Ek
 * C18): its semver, the commit it was built from and a plain-text note.
 * Never deleted: it is history (a shop may still run it or report it).
 * Only the note changes after it is made.
 */
export const Release = model
  .define("release", {
    id: model.id({ prefix: "rel" }).primaryKey(),
    /** Strict semver, as the shops report it (`1.4.0`, `1.5.0-rc.1`). */
    version: model.text(),
    /** Lowercase hex, 7 to 40 characters. */
    commit: model.text(),
    notes: model.text().nullable(),
    /** The staff member (a user id) who added it. */
    created_by: model.text().nullable(),
  })
  .indexes([
    { on: ["version"], unique: true, where: "deleted_at IS NULL" },
    { on: ["created_at"], where: "deleted_at IS NULL" },
  ])

/**
 * The release a shop should run (adr/0061 §2 `fleet` `tenant_version`, Ek
 * C18): one row per shop, its target (null: none set), who set it, when
 * and why. Only intent: nothing upgrades a shop from it until F16.6's
 * waves. What the shop runs is its latest usage report's release, never
 * copied here.
 */
export const TenantVersion = model
  .define("tenant_version", {
    id: model.id({ prefix: "tver" }).primaryKey(),
    tenant_id: model.text(),
    target_release_id: model.text().nullable(),
    /** The staff member (a user id) who set it last. */
    set_by: model.text().nullable(),
    set_at: model.dateTime(),
    /** Why, as typed (plain text; not in the audit row). */
    reason: model.text(),
  })
  .indexes([
    { on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["target_release_id"], where: "deleted_at IS NULL" },
  ])
