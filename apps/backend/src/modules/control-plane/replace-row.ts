import type { PlanSource } from "./models/control-plane-plan"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** A stored row's values, the document as it was signed. */
export interface PlanRowValues {
  serial: number
  document: unknown
  kid: string
  signature: string
  received_at: Date
  confirmed_at: Date | null
  source: PlanSource
}

/**
 * Writes a plan document over the shop's row, whole (review of adr/0069
 * slice 1). Medusa's `update` assigns with `mergeObjectProperties: true`
 * (its MikroORM repository): a JSON column is deep-merged with what it
 * held, so a key the new document no longer has (a platform flag it does
 * not name, an optional billing field) would survive from the old one. The
 * stored document would then differ from the signed one, fail its check on
 * every load (the shop falls back to `restricted`) and give no flags.
 * Written here with SQL instead: the row holds exactly what was signed.
 */
export async function replacePlanRow(
  executor: Executor,
  id: string,
  values: PlanRowValues
): Promise<void> {
  await executor.execute(
    `UPDATE "control_plane_plan"
     SET "serial" = ?, "document" = ?::jsonb, "kid" = ?, "signature" = ?,
         "received_at" = ?, "confirmed_at" = ?, "source" = ?, "updated_at" = now()
     WHERE "id" = ? AND "deleted_at" IS NULL`,
    [
      values.serial,
      JSON.stringify(values.document),
      values.kid,
      values.signature,
      values.received_at,
      values.confirmed_at,
      values.source,
      id,
    ]
  )
}
