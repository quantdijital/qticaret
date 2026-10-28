import type { ExecArgs } from "@medusajs/framework/types"
import { ensureLocationCarriers } from "../scripts/bootstrap/location-carriers"

/**
 * Runs once per shop, on the `db:migrate` that brings the contract
 * carriers (adr/0035): the default warehouse can ship with Aras and
 * Yurtiçi too. Nothing ships with them until the shop enters its account
 * and makes a shipping option.
 */
export default async function contractCarriersLocation({ container }: ExecArgs) {
  await ensureLocationCarriers(container)
}
