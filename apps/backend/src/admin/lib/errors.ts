import type { useTranslation } from "react-i18next"

type Translate = ReturnType<typeof useTranslation>["t"]

// Our API answers with an i18n key as the message (`seo.template_invalid`)
const MESSAGE_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

/**
 * An API error as text for the admin. A key (`seo.template_invalid`) is
 * translated here. The dashboard gets the server's sentence instead
 * (adr/0021): shown as it is, but only for a 4xx answer, so a network
 * failure or a script error never shows its internals.
 */
export function errorText(t: Translate, error: unknown): string {
  const fields = error as { message?: unknown; status?: unknown } | null
  const message = fields?.message
  const generic = t("qticaret.errors.generic")
  if (typeof message !== "string" || message.trim() === "") {
    return generic
  }
  if (MESSAGE_KEY.test(message)) {
    return t(`qticaret.serverErrors.${message}`, { defaultValue: generic })
  }
  const status = fields?.status
  return typeof status === "number" && status >= 400 && status < 500 ? message : generic
}
