import { isReauthCancelled } from "./reauth"
import type { TFunction } from "i18next"

interface ApiFailure {
  status?: unknown
  message?: unknown
}

/**
 * An API error as text. The backend answers the panel (a session client)
 * with a sentence in `message` and the key in `code` (adr/0021), shown as
 * it is for a 4xx; anything else (network, 5xx, a script error) gets the
 * generic line so no internals reach the screen.
 */
export function errorText(t: TFunction, error: unknown): string {
  // The person closed the step-up dialog: nothing went wrong
  if (isReauthCancelled(error)) {
    return t("reauth.cancelled")
  }
  const failure = error as ApiFailure | null
  const status = failure?.status
  const message = failure?.message
  if (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    typeof message === "string" &&
    message.trim() !== ""
  ) {
    return message
  }
  return t("errors.generic")
}

export const isUnauthorized = (error: unknown): boolean =>
  (error as ApiFailure | null)?.status === 401
