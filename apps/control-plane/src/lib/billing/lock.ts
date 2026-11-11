import type { MedusaContainer } from "@medusajs/framework/types"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Container = Pick<MedusaContainer, "resolve">

/**
 * One shop's billing decisions, one at a time, in every process (Ek C16
 * review M1): a transaction-scoped Postgres advisory lock on
 * `billing:<shop>`, held on its own connection while `run` works. Every
 * path that changes a shop's charges, its grace or its status by billing
 * (the hourly run, a staff action on a charge, the grace, a suspension's
 * end) runs inside it, so a decision is always taken on what the others
 * left, never on what they are still changing. Not re-entrant: `run`
 * must not take it again.
 */
export async function withBillingLock<T>(
  container: Container,
  tenantId: string,
  run: () => Promise<T>
): Promise<T> {
  const pg = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  return await pg.transaction(async (trx) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [`billing:${tenantId}`])
    return await run()
  })
}
