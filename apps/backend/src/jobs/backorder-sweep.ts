import type { MedusaContainer } from "@medusajs/framework/types"
import { sweepBackorderRaises } from "../workflows/payments/backorder-sweep"

/**
 * Every minute: stock raised for a paid cart's completion and left so (a
 * crash) is lowered back (adr/0026 Ek 2026-11-06). Medusa v2 runs startup
 * code only in a module's loader, with the module's own container, so the
 * first run after a restart is this job's, within a minute.
 */
export default async function backorderSweep(container: MedusaContainer) {
  await sweepBackorderRaises(container)
}

export const config = {
  name: "payments-backorder-sweep",
  schedule: "* * * * *",
}
