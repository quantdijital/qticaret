"use client"

import { ErrorPage } from "@qticaret/storefront-theme-error"
import { errorT as t } from "@/lib/i18n/error"

/**
 * A page the server could not make (the backend busy or away), inside the
 * shop's frame when the frame stands: the theme's error page (adr/0046 Ek
 * 2026-11-05), which needs no data. "Tekrar dene" asks the server again
 * (`unstable_retry`), where Next has it; else it redraws (`reset`).
 */
export default function PageError({
  reset,
  unstable_retry: retry,
}: {
  error: Error
  reset: () => void
  unstable_retry?: () => void
}) {
  return <ErrorPage t={t} retry={retry ?? reset} />
}
