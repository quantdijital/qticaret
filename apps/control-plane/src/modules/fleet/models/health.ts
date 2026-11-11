import { model } from "@medusajs/framework/utils"

/** What the control plane probes of a shop (Ek C13): its backend's `/health`, its storefront's home. */
export const HEALTH_TARGETS = ["backend", "storefront"] as const
export type HealthTarget = (typeof HEALTH_TARGETS)[number]

/**
 * A target's standing (Ek C13): `healthy` after a probe answered 200,
 * `failing` after fewer failures in a row than `UNHEALTHY_AFTER`,
 * `unhealthy` from then on. No row: never probed (unknown).
 */
export const HEALTH_STATES = ["healthy", "failing", "unhealthy"] as const
export type HealthState = (typeof HEALTH_STATES)[number]

/**
 * One probe (adr/0061 §2 `fleet` `health_check`, Ek C13): when, whether it
 * answered 200, the HTTP status, how long the answer took and the failure
 * as a code (never a body or a message). Kept 24 hours: the short history.
 */
export const HealthCheck = model
  .define("health_check", {
    id: model.id({ prefix: "hchk" }).primaryKey(),
    tenant_id: model.text(),
    target: model.enum([...HEALTH_TARGETS]),
    checked_at: model.dateTime(),
    ok: model.boolean(),
    status_code: model.number().nullable(),
    latency_ms: model.number().nullable(),
    error: model.text().nullable(),
  })
  .indexes([
    { on: ["tenant_id", "target", "checked_at"] },
    { name: "IDX_health_check_checked_at", on: ["checked_at"] },
  ])

/**
 * The latest standing of a shop's target (Ek C13): one row per shop and
 * target, written by every probe; the shops list (and C18's dashboard)
 * read it without going through the history.
 */
export const HealthStanding = model
  .define("health_standing", {
    id: model.id({ prefix: "hstand" }).primaryKey(),
    tenant_id: model.text(),
    target: model.enum([...HEALTH_TARGETS]),
    state: model.enum([...HEALTH_STATES]),
    consecutive_failures: model.number().default(0),
    checked_at: model.dateTime(),
    last_ok_at: model.dateTime().nullable(),
    /** When the failure that made it unhealthy came; null while healthy or failing. */
    unhealthy_since: model.dateTime().nullable(),
    status_code: model.number().nullable(),
    latency_ms: model.number().nullable(),
    error: model.text().nullable(),
  })
  .indexes([{ on: ["tenant_id", "target"], unique: true, where: "deleted_at IS NULL" }])
