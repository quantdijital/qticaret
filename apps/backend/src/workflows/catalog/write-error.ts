import { MedusaError } from "@medusajs/framework/utils"
import { isConflictError, isValidationError } from "../../lib/errors"
import { serverErrorMessage } from "../../lib/errors/messages"

/**
 * Why a product's write was refused, in a report's words (import, bulk
 * edit): our checks' sentences, Medusa's refusals as they are, anything
 * else the generic sentence (an internal message stays in the log).
 */
export function writeErrorText(error: unknown): string {
  if (isValidationError(error) || isConflictError(error)) {
    return serverErrorMessage(error.safeMessage, "tr")
  }
  if (MedusaError.isMedusaError(error) && error.type !== MedusaError.Types.UNEXPECTED_STATE) {
    return `${serverErrorMessage("catalog_import.write_failed", "tr")} ${error.message}`
  }
  return serverErrorMessage("catalog_import.write_failed", "tr")
}
