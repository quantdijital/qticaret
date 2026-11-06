import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { NOT_FOUND_HEADER } from "@/lib/seo/gone"
import { waysOn } from "@/lib/views/category-tiles"
import { theme } from "@/theme"

// As `app/not-found.tsx` says it
export const metadata: Metadata = {
  title: { absolute: t("not_found.title") },
  robots: "noindex,follow",
}

/**
 * `/_bulunamadi` (`%5F` is Next's escape for a leading underscore): an
 * address resolve knows nothing at, rewritten here by the proxy with its
 * 404 (`lib/seo/gone.ts`). The theme's 404 with its ways on, rendered as a
 * page so the heading, the search and the categories are in the first
 * HTML; `notFound()` would leave Next's empty error shell. Asked for by its
 * own address, it is no page.
 */
export default async function NotFoundPage() {
  if ((await headers()).get(NOT_FOUND_HEADER) !== "1") {
    notFound()
  }
  return <theme.NotFoundPage t={t} view={{ categories: await waysOn() }} />
}
