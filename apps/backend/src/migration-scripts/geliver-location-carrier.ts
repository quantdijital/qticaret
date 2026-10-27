import type { ExecArgs } from "@medusajs/framework/types"
import { ensureLocationCarriers } from "../scripts/bootstrap/location-carriers"

/**
 * Runs once per shop, on the `db:migrate` that brings Geliver (F7, adr/0031):
 * the default warehouse can ship with it. Nothing ships with it until the
 * shop connects its account and makes a shipping option for it.
 */
export default async function geliverLocationCarrier({ container }: ExecArgs) {
  await ensureLocationCarriers(container)
}
