import { model } from "@medusajs/framework/utils"

export const PLAN_SOURCES = ["push", "pull"] as const
export type PlanSource = (typeof PLAN_SOURCES)[number]

/**
 * The last valid plan document from the control plane (adr/0061 §3.3,
 * §5.1, Ek C9): stored as received with its `kid` and signature, so it can
 * be checked again at any time. One row per shop id; a greater serial
 * replaces it. `confirmed_at` moves whenever the control plane hands over
 * this document or a newer one (a repeated push, a pull): a shop that has
 * heard nothing for 24 hours says so in its log.
 */
export const ControlPlanePlan = model
  .define("control_plane_plan", {
    id: model.id({ prefix: "cpplan" }).primaryKey(),
    tenant_id: model.text(),
    serial: model.number(),
    document: model.json(),
    kid: model.text(),
    signature: model.text(),
    received_at: model.dateTime(),
    confirmed_at: model.dateTime(),
    source: model.enum([...PLAN_SOURCES]),
  })
  .indexes([{ on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" }])
