import { model } from "@medusajs/framework/utils"

export const PRIVACY_REQUEST_KINDS = ["export", "erasure"] as const
export const PRIVACY_REQUEST_CHANNELS = ["email", "phone", "letter", "in_person", "other"] as const
export const PRIVACY_REQUEST_STATUSES = ["open", "completed", "rejected"] as const

/**
 * A customer's KVKK request (F13.5, adr/0041 §6), recorded by staff as it
 * came: a copy of their data, or its erasure; how it came, when, who
 * recorded it, and when and by whom it was answered. The law gives 30 days.
 * No free text: what the customer wrote stays where it came.
 */
export const PrivacyRequest = model
  .define("privacy_request", {
    id: model.id({ prefix: "preq" }).primaryKey(),
    customer_id: model.text(),
    kind: model.enum([...PRIVACY_REQUEST_KINDS]),
    channel: model.enum([...PRIVACY_REQUEST_CHANNELS]),
    received_at: model.dateTime(),
    recorded_by: model.text(),
    status: model.enum([...PRIVACY_REQUEST_STATUSES]).default("open"),
    /** An export's job: its file is the answer. */
    job_id: model.text().nullable(),
    completed_at: model.dateTime().nullable(),
    completed_by: model.text().nullable(),
  })
  .indexes([
    { name: "IDX_privacy_request_customer", on: ["customer_id"], where: "deleted_at IS NULL" },
  ])
