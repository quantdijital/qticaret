import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { waysOn } from "@/lib/views/category-tiles"
import { theme } from "@/theme"

export const metadata: Metadata = {
  title: { absolute: t("not_found.title") },
  robots: "noindex,follow",
}

/**
 * A 404 with the shop's top categories as the way on (adr/0046 Ek 2026-11-05),
 * for a page that finds out itself that it is none (a list past its last
 * page, an order not the visitor's). Next 16 sends such a page as an empty
 * shell the browser's script fills; an address resolve knows nothing at
 * comes whole from `/_bulunamadi` instead (`lib/seo/gone.ts`).
 */
export default async function NotFound() {
  return <theme.NotFoundPage t={t} view={{ categories: await waysOn() }} />
}
