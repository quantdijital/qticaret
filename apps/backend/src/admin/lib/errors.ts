import type { useTranslation } from "react-i18next"

type Translate = ReturnType<typeof useTranslation>["t"]

// Our API answers with an i18n key as the message (`seo.template_invalid`)
const MESSAGE_KEY = /^[a-z_]+\.[a-z_]+$/

/** An API error as text for the admin: our key translated, anything else a generic line. */
export function errorText(t: Translate, error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message
  const generic = t("qticaret.errors.generic")
  return typeof message === "string" && MESSAGE_KEY.test(message)
    ? t(`qticaret.serverErrors.${message}`, { defaultValue: generic })
    : generic
}
