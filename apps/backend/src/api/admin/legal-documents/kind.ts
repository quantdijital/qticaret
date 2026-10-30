import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { isLegalKind } from "../../../lib/legal"
import type { LegalKind } from "../../../lib/legal"

/** The route's `:kind`, or 404: only the kinds the platform knows. */
export function kindOf(req: MedusaRequest): LegalKind {
  const kind = (req.params as Record<string, string | undefined>)["kind"] ?? ""
  if (!isLegalKind(kind)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "legal.unknown")
  }
  return kind
}
