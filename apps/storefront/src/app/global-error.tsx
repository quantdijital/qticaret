"use client"

import { ErrorPage } from "@qticaret/storefront-theme-error"
import { errorT as t } from "@/lib/i18n/error"
// The chosen theme's stylesheet (adr/0057): this page stands in for the root layout
import "@qticaret/storefront-theme-styles"

/**
 * When the shop's frame itself could not be made (the backend away: the
 * root layout reads the shop's settings, menus and cart), Next draws this
 * page in its place: the theme's error page alone, with its look but no
 * frame and no data (adr/0046 Ek 2026-11-05). Next answers it with a 500.
 */
export default function GlobalError({
  reset,
  unstable_retry: retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry?: () => void
}) {
  return (
    <html lang="tr">
      <body>
        <title>{t("error.title")}</title>
        <ErrorPage t={t} retry={retry ?? reset} />
      </body>
    </html>
  )
}
