import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"

/**
 * Whether the caller is the shop's own program (an API key) rather than
 * staff (the F15 security review): a program issues and writes back sale
 * invoices only. A return's document (gider pusulası, a company's return
 * invoice) is staff's, so a key never lists it, reads its draft (the
 * buyer's tax id) or replaces its PDF (staff's signed scan).
 */
export const isProgram = (req: MedusaRequest): boolean =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_type !== "user"

/** A program may reach only a sale's invoice. */
export const programMayReach = (req: MedusaRequest, kind: string): boolean =>
  !isProgram(req) || kind === "sale"
