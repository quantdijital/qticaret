import { MedusaService } from "@medusajs/framework/utils"
import { Chargeback } from "./models/chargeback"

export type ChargebackStatus = "open" | "evidence_submitted" | "won" | "lost"

/** Where a dispute may go from each state (adr/0030); a closed one goes nowhere. */
export const NEXT_STATUS: Readonly<Record<ChargebackStatus, readonly ChargebackStatus[]>> = {
  open: ["evidence_submitted", "won", "lost"],
  evidence_submitted: ["won", "lost"],
  won: [],
  lost: [],
}

export const isClosed = (status: ChargebackStatus): boolean => NEXT_STATUS[status].length === 0

/** Disputes of order payments (F6.7, adr/0030). */
class ChargebacksModuleService extends MedusaService({ Chargeback }) {}

export default ChargebacksModuleService
