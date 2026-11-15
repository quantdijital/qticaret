import { model } from "@medusajs/framework/utils"

/**
 * A customer's wholesale record (ADR-0068 §1). Pending, it holds only the
 * invited address (lower case), the company and the contact's name; once
 * active the customer record is the one source and these are cleared.
 * Its own prices live in a private `override` list for a one-member hidden
 * group, every row of which also carries that group as a price rule, so
 * it outranks the level's list (Ek 2026-11-15). Opened, changed, closed
 * and taken on sign-in by `workflows/wholesale/accounts/`.
 */
export const WholesaleAccount = model
  .define("wholesale_account", {
    id: model.id({ prefix: "wacc" }).primaryKey(),
    /** Null while pending without an account to bind to. */
    customer_id: model.text().nullable(),
    email: model.text().nullable(),
    company_name: model.text().nullable(),
    contact_name: model.text().nullable(),
    tier_id: model.text().nullable(),
    private_group_id: model.text().nullable(),
    private_price_list_id: model.text().nullable(),
    rate_bps: model.number().nullable(),
    /** Overrides the level's; null: the level's, or no rule. */
    min_quantity: model.number().nullable(),
    /** Invitations sent while pending, the first counted; a resend is capped (review L2). */
    invite_count: model.number().default(1),
    /**
     * The sign-in is one staff made or took over (Ek 2026-11-15 (2), review
     * M4): only then may staff set a new password; a customer who proved
     * their own address keeps theirs. Set by the server only.
     */
    staff_login: model.boolean().default(false),
    status: model.enum(["pending", "active", "inactive"]).default("pending"),
    invited_at: model.dateTime().nullable(),
    activated_at: model.dateTime().nullable(),
    deactivated_at: model.dateTime().nullable(),
    sync_requested_at: model.dateTime().nullable(),
    synced_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([
    { on: ["customer_id"], unique: true, where: "deleted_at IS NULL AND customer_id IS NOT NULL" },
    { on: ["email"], unique: true, where: "deleted_at IS NULL AND email IS NOT NULL" },
    { on: ["tier_id"], where: "deleted_at IS NULL" },
    {
      on: ["private_group_id"],
      unique: true,
      where: "deleted_at IS NULL AND private_group_id IS NOT NULL",
    },
    {
      on: ["private_price_list_id"],
      unique: true,
      where: "deleted_at IS NULL AND private_price_list_id IS NOT NULL",
    },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
