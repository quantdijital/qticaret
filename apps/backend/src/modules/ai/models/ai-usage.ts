import { model } from "@medusajs/framework/utils"

/**
 * One attempt at an AI service (adr/0071 §5), failed ones too: what was
 * asked of which service, how it ended, what the service counted and what
 * the registry's unit prices make of it (an estimate, never an invoice).
 * The prompt and the output are not kept here: a text suggestion's prompt
 * stays on its `content_draft`.
 */
export const AiUsage = model
  .define("ai_usage", {
    id: model.id({ prefix: "aiuse" }).primaryKey(),
    task: model.text(),
    capability: model.text(),
    service: model.text(),
    model: model.text(),
    funding: model.enum(["own_key", "platform_credit"]),
    /** refused: the output did not pass the gate and was not offered. */
    status: model.enum(["succeeded", "refused", "failed", "timeout", "cancelled"]),
    input_tokens: model.number().nullable(),
    output_tokens: model.number().nullable(),
    images: model.number().nullable(),
    seconds: model.number().nullable(),
    estimated_cost_micros: model.number().nullable(),
    currency: model.text().nullable(),
    /** Platform credits spent (`platform_credit` only). */
    credits: model.number().nullable(),
    entity_type: model.text().nullable(),
    entity_id: model.text().nullable(),
    /** The `content_draft` of a text suggestion. */
    suggestion_id: model.text().nullable(),
    /** The `async_job` of a long task. */
    job_id: model.text().nullable(),
    duration_ms: model.number().nullable(),
    /** A short code of ours (`http_429`, `timeout`); never the service's text. */
    error_code: model.text().nullable(),
    /** The staff member's user id; emptied when they leave (docs/kvkk-envanter.md §4). */
    requested_by: model.text().nullable(),
  })
  .indexes([
    { on: ["created_at"], where: "deleted_at IS NULL" },
    { on: ["task", "created_at"], where: "deleted_at IS NULL" },
    { on: ["service", "created_at"], where: "deleted_at IS NULL" },
  ])
