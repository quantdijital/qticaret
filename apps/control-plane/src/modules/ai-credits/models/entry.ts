import { model } from "@medusajs/framework/utils"

export const AI_CREDIT_ENTRY_KINDS = [
  "grant_purchase",
  "grant_plan_monthly",
  "spend",
  "release",
  "expire",
  "adjust",
] as const
export type AiCreditEntryKind = (typeof AI_CREDIT_ENTRY_KINDS)[number]

export const AI_CREDIT_BUCKETS = ["plan", "purchased"] as const
export type AiCreditBucket = (typeof AI_CREDIT_BUCKETS)[number]

/**
 * One movement of a wallet's credits (adr/0085 §1), append-only: the
 * ledger is the record of truth, and a bucket's rows add up to the
 * wallet's balance (the reconcile job checks). `amount` is signed (a spend
 * or an expiry is negative), never 0. `grant_ref` names a grant once: a
 * top-up or a month's grant written twice is refused by its unique index.
 * The database refuses an update or a delete (the migration's trigger).
 * `actor` is a staff user's id or `system`; no prompt or answer is kept.
 */
export const AiCreditEntry = model
  .define("ai_credit_entry", {
    id: model.id({ prefix: "aient" }).primaryKey(),
    tenant_id: model.text(),
    kind: model.enum([...AI_CREDIT_ENTRY_KINDS]),
    amount: model.number(),
    bucket: model.enum([...AI_CREDIT_BUCKETS]),
    operation_id: model.text().nullable(),
    grant_ref: model.text().nullable(),
    note: model.text().nullable(),
    actor: model.text(),
  })
  .indexes([
    { on: ["tenant_id", "created_at"], where: "deleted_at IS NULL" },
    {
      on: ["tenant_id", "operation_id"],
      where: "operation_id IS NOT NULL AND deleted_at IS NULL",
    },
    { on: ["grant_ref"], unique: true, where: "grant_ref IS NOT NULL AND deleted_at IS NULL" },
  ])
