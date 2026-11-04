import { isReauthCancelled } from "./reauth"
import type { TFunction } from "i18next"

interface ApiFailure {
  status?: unknown
  statusText?: unknown
  message?: unknown
  /** The backend's key, where the caller kept the body (adr/0021). */
  code?: unknown
  provider?: unknown
  provider_message?: unknown
}

/** The backend's key for a provider's failure on the admin API. */
export const PROVIDER_FAILED = "provider.failed"
// Our own names for the services (`aras`): never text from outside
const PROVIDER_ID = /^[a-z][a-z0-9_-]{0,31}$/
// A provider's failure: refused (502) or out of reach (503)
const PROVIDER_STATUSES = new Set([502, 503])

/**
 * A provider's failure (a carrier, the SMS or invoice service) in words:
 * which service, and what it said. With the body kept (a request made
 * with `fetch`), from its key and parts in the panel's own words; through
 * the SDK, which keeps only the sentence, the backend's sentence naming
 * them (made safe there: no credentials, no addresses). A 502/503 with no
 * sentence of ours (a proxy's page) is no provider's word: null.
 */
function providerFailureText(t: TFunction, failure: ApiFailure): string | null {
  const { status, message, code, provider } = failure
  if (typeof status !== "number" || !PROVIDER_STATUSES.has(status)) {
    return null
  }
  if (code === PROVIDER_FAILED && typeof provider === "string" && PROVIDER_ID.test(provider)) {
    const name = t(`errors.providerNames.${provider}`, { defaultValue: provider })
    const said = failure.provider_message
    if (typeof said === "string" && said.trim() !== "") {
      return t("errors.provider.said", { provider: name, message: said })
    }
    return t(status === 503 ? "errors.provider.unreachable" : "errors.provider.failed", {
      provider: name,
    })
  }
  return typeof message === "string" && message.trim() !== "" && message !== failure.statusText
    ? message
    : null
}

/**
 * An API error as text. The backend answers the panel (a session client)
 * with a sentence in `message` and the key in `code` (adr/0021), shown as
 * it is for a 4xx and for a provider's failure (502, 503: which service,
 * what it said); anything else (network, 500, a script error) gets the
 * generic line so no internals reach the screen.
 */
export function errorText(t: TFunction, error: unknown): string {
  // The person closed the step-up dialog: nothing went wrong
  if (isReauthCancelled(error)) {
    return t("reauth.cancelled")
  }
  const failure = (error ?? {}) as ApiFailure
  const provider = providerFailureText(t, failure)
  if (provider !== null) {
    return provider
  }
  const { status, message } = failure
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

/**
 * A failed `fetch` answer as the errors the SDK throws, its body's key and
 * a provider's parts kept beside the sentence, for `errorText`.
 */
export async function responseFailure(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const text = (key: string) => (typeof body?.[key] === "string" ? body[key] : undefined)
  const message = text("message") ?? ""
  return Object.assign(new Error(message || `http_${String(response.status)}`), {
    status: response.status,
    statusText: response.statusText,
    message,
    code: text("code") ?? null,
    provider: text("provider") ?? null,
    provider_message: text("provider_message") ?? null,
  })
}

export const isUnauthorized = (error: unknown): boolean =>
  (error as ApiFailure | null)?.status === 401
