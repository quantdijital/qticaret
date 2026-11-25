import { model } from "@medusajs/framework/utils"

export const AI_CREDIT_OPERATION_STATUSES = ["open", "charged", "released"] as const
export type AiCreditOperationStatus = (typeof AI_CREDIT_OPERATION_STATUSES)[number]

/**
 * One charged operation of a shop (adr/0085 K3, §1): its credits are taken
 * once, on its first call; later calls with the same id (a correction,
 * one "Yeniden dene") count in `calls` up to the task's cap. The split
 * between the buckets is kept so a release gives back to the same ones.
 * `open` until the provider answers: `charged` with its measures, or
 * `released` with the credits back. The prompt and the answer are never
 * kept: there is no column for them.
 */
export const AiCreditOperation = model
  .define("ai_credit_operation", {
    id: model.id({ prefix: "aiop" }).primaryKey(),
    tenant_id: model.text(),
    operation_id: model.text(),
    task: model.text(),
    capability: model.text(),
    credits: model.number(),
    plan_credits: model.number(),
    purchased_credits: model.number(),
    calls: model.number().default(1),
    status: model.enum([...AI_CREDIT_OPERATION_STATUSES]).default("open"),
    service: model.text().nullable(),
    model: model.text().nullable(),
    input_tokens: model.number().nullable(),
    output_tokens: model.number().nullable(),
    images: model.number().nullable(),
    /** The provider's estimated cost in millionths of a US dollar (K12). */
    estimated_cost_micros: model.number().nullable(),
    closed_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["tenant_id", "operation_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "created_at"], where: "deleted_at IS NULL" },
  ])
