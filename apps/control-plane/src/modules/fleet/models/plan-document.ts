import { model } from "@medusajs/framework/utils"

/**
 * Where a document's push stands (Ek C9): `pending` until the shop takes
 * it (retried with backoff), `delivered`, `failed` once the retries ran
 * out, `superseded` when a newer document was issued first. A push is
 * best effort; the shop's pull covers every state.
 */
export const PLAN_PUSH_STATUSES = ["pending", "delivered", "failed", "superseded"] as const
export type PlanPushStatus = (typeof PLAN_PUSH_STATUSES)[number]

/**
 * A plan document issued to a shop (adr/0061 §2 `fleet`, §3.2): the signed
 * body as sent, its `serial` (per shop, growing by one, issued under the
 * shop's advisory lock), the hash of its content without serial and time
 * (a document is issued again only when that changes), and what became
 * of its push and pulls. Rows are kept: the history of what a shop was
 * told. No secret and no personal data in a document.
 */
export const PlanDocument = model
  .define("plan_document", {
    id: model.id({ prefix: "plandoc" }).primaryKey(),
    tenant_id: model.text(),
    serial: model.number(),
    document: model.json(),
    content_hash: model.text(),
    kid: model.text(),
    signature: model.text(),
    issued_at: model.dateTime(),
    push_status: model.enum([...PLAN_PUSH_STATUSES]).default("pending"),
    push_attempts: model.number().default(0),
    /** The last push's error code (never a response body); null after a delivery. */
    push_error: model.text().nullable(),
    pushed_at: model.dateTime().nullable(),
    next_push_at: model.dateTime().nullable(),
    /** The last time the shop pulled this document (`GET /tenant-api/v1/plan`). */
    pulled_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["tenant_id", "serial"], unique: true, where: "deleted_at IS NULL" },
    {
      name: "IDX_plan_document_push_due",
      on: ["next_push_at"],
      where: "push_status = 'pending' AND deleted_at IS NULL",
    },
  ])
