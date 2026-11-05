import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { waysOn } from "@/lib/views/category-tiles"
import { theme } from "@/theme"

export const metadata: Metadata = {
  title: { absolute: t("not_found.title") },
  robots: "noindex,follow",
}

/** A 404 with the shop's top categories as the way on (adr/0046 Ek 2026-11-05). */
export default async function NotFound() {
  return <theme.NotFoundPage t={t} view={{ categories: await waysOn() }} />
}
