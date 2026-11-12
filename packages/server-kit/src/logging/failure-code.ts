/**
 * A failure written to a log by its code alone (adr/0061 Ek C17 review L2,
 * Ek C19 M1): a database driver's message carries its SQL with the bound
 * values (an e-mail, an address, a sealed text), and its `cause` the same,
 * so neither a message, a stack nor a cause is ever logged where the error
 * may have come from a database write.
 */

const CODE = /^[A-Za-z0-9_.-]{1,64}$/

function ownCode(error: unknown): string | undefined {
  const code =
    error !== null && typeof error === "object" ? (error as { code?: unknown }).code : undefined
  if (typeof code === "string" && CODE.test(code)) {
    return code
  }
  return typeof code === "number" && Number.isInteger(code) ? String(code) : undefined
}

/**
 * The error's own code (a Postgres SQLSTATE, `envelope.*`), else its
 * `cause`'s (MikroORM wraps the driver's error one level deep), else
 * `unknown`. Never the message.
 */
export function failureCode(error: unknown): string {
  const cause =
    error !== null && typeof error === "object" ? (error as { cause?: unknown }).cause : undefined
  return ownCode(error) ?? ownCode(cause) ?? "unknown"
}

// A stable refusal key a service throws as its message: `cp.slug_taken`,
// `provisioning.no_port`. Fixed words, never input
const KEY_MESSAGE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

/** The error's message when it is a stable key (`cp.slug_taken`), else null. */
export function keyMessage(error: unknown): string | null {
  const message =
    error !== null && typeof error === "object"
      ? (error as { message?: unknown }).message
      : undefined
  return typeof message === "string" && message.length <= 64 && KEY_MESSAGE.test(message)
    ? message
    : null
}

/**
 * The code a log line may carry for an error that could quote input: its
 * message when that is a stable key (`cp.*`), else `failureCode`.
 */
export const loggableCode = (error: unknown): string => keyMessage(error) ?? failureCode(error)

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

/**
 * `errorSummary`'s stand-in where the error may come from a database
 * write: the error's class name (`DriverException`, `Error`) and its
 * `loggableCode`, never the message.
 */
export function codeSummary(error: unknown): { name?: string; code: string } {
  const name =
    error !== null && typeof error === "object" ? (error as { name?: unknown }).name : undefined
  return {
    ...(typeof name === "string" && NAME.test(name) ? { name } : {}),
    code: loggableCode(error),
  }
}
