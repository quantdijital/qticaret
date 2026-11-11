import type { TFunction } from "i18next"

/** A probe's failure code in words (`health.http_503` → "HTTP 503 yanıtı"); the code when unknown. */
export function probeErrorText(t: TFunction, code: string): string {
  const http = /^health\.http_(\d{3})$/.exec(code)
  if (http) {
    return t("health.errors.http", { status: http[1] })
  }
  const key = code.replace(/^health\./, "")
  return t(`health.errors.${key}`, { defaultValue: code })
}
