import { logger } from "../../lib/logging"

/**
 * Failures on the sealed rows are logged by code alone (adr/0061 Ek C17
 * review L2): a database error's message carries its SQL with the bound
 * values, which here are the sealed texts, so no message, stack or cause
 * is ever written.
 */

const CODE = /^[A-Za-z0-9_.-]{1,64}$/

/** The error's own code (a Postgres SQLSTATE, `envelope.*`), or `unknown`. */
export function failureCode(error: unknown): string {
  const code =
    error !== null && typeof error === "object" ? (error as { code?: unknown }).code : undefined
  if (typeof code === "string" && CODE.test(code)) {
    return code
  }
  return typeof code === "number" && Number.isInteger(code) ? String(code) : "unknown"
}

export function logCredentialFailure(
  level: "warn" | "error",
  event: string,
  error: unknown,
  fields: Readonly<Record<string, string>> = {}
): void {
  logger[level]({ event, ...fields, code: failureCode(error) })
}
