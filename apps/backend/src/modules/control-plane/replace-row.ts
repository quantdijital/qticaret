import type { PlanSource } from "./models/control-plane-plan"

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

// The part of knex's query builder used here (a transaction is called with a table name)
interface UpdateQuery {
  update: (values: Record<string, unknown>) => UpdateQuery
  where: (condition: Record<string, unknown>) => UpdateQuery
  whereNull: (column: string) => UpdateQuery
  returning: (column: string) => PromiseLike<unknown[]>
}

/** The workflow's transactional manager: MikroORM's knex transaction is its context. */
export interface TransactionalManager {
  getTransactionContext: () => ((table: string) => UpdateQuery) | undefined
}

/**
 * Writes a plan document over the shop's row, whole (review of adr/0069
 * slice 1). Medusa's `update` assigns with `mergeObjectProperties: true`
 * (its MikroORM repository): a JSON column is deep-merged with what it
 * held, so a key the new document no longer has (a platform flag it does
 * not name, an optional billing field) would survive from the old one. The
 * stored document would then differ from the signed one, fail its check on
 * every load (the shop falls back to `restricted`) and give no flags.
 *
 * Through knex's query builder in the workflow's own transaction, with the
 * values bound by the database driver (security review A-1): MikroORM's
 * `execute(sql, params)` writes the values into the SQL text and knex then
 * turns every `?` left in it, inside the document's text too, into a `$n`
 * placeholder (`positionBindings`), so a document with a `?` in its words
 * would fail to store or be stored changed. Exactly one live row must be
 * written (A-2); anything else throws and the transaction is rolled back.
 */
export async function replacePlanRow(
  manager: TransactionalManager,
  id: string,
  values: PlanRowValues
): Promise<void> {
  const trx = manager.getTransactionContext()
  if (!trx) {
    throw new Error("control plane: a plan row is replaced inside a transaction only")
  }
  const written = await trx("control_plane_plan")
    .update({
      serial: values.serial,
      document: JSON.stringify(values.document),
      kid: values.kid,
      signature: values.signature,
      received_at: values.received_at,
      confirmed_at: values.confirmed_at,
      source: values.source,
      updated_at: new Date(),
    })
    .where({ id })
    .whereNull("deleted_at")
    .returning("id")
  if (written.length !== 1) {
    throw new Error(`control plane: a plan row replace wrote ${String(written.length)} rows`)
  }
}
