import { failureCode } from "@qticaret/server-kit"
import { logger } from "../../lib/logging"

/**
 * Failures on the sealed rows are logged by code alone (adr/0061 Ek C17
 * review L2): a database error's message carries its SQL with the bound
 * values, which here are the sealed texts, so no message, stack or cause
 * is ever written. The rule itself is server-kit's, shared with the
 * control plane (Ek C19 M1).
 */
export { failureCode }

export function logCredentialFailure(
  level: "warn" | "error",
  event: string,
  error: unknown,
  fields: Readonly<Record<string, string>> = {}
): void {
  logger[level]({ event, ...fields, code: failureCode(error) })
}
