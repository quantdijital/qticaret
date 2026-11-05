import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { GONE_HEADER } from "@/lib/seo/gone"
import { waysOn } from "@/lib/views/category-tiles"
import { theme } from "@/theme"

// As the proxy's own short page said it before (adr/0046 §4)
export const metadata: Metadata = {
  title: { absolute: t("gone.title") },
  robots: "noindex",
}

/**
 * `/_kaldirildi` (the folder's `%5F` is Next's escape for a leading
 * underscore): a removed address, rewritten here by the proxy with its
 * 410 (adr/0046 Ek 2026-11-05). The theme's removed page in the shop's
 * frame, with the 404's ways on; a theme without one shows its 404. Asked
 * for by its own address, it is no page.
 */
export default async function Gone() {
  if ((await headers()).get(GONE_HEADER) !== "1") {
    notFound()
  }
  const Page = theme.GonePage ?? theme.NotFoundPage
  return <Page t={t} view={{ categories: await waysOn() }} />
}
