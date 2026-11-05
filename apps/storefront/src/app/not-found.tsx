import type { Metadata } from "next"
import type { CategoryCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { categoryTiles } from "@/lib/views/category-tiles"
import { theme } from "@/theme"

export const metadata: Metadata = {
  title: { absolute: t("not_found.title") },
  robots: "noindex,follow",
}

/**
 * The shop's top categories with their pictures, the way on from a missing
 * page. A 404 never fails for want of them: unanswered, it has none.
 */
async function waysOn(): Promise<CategoryCardView[]> {
  try {
    return await categoryTiles([])
  } catch {
    return []
  }
}

export default async function NotFound() {
  return <theme.NotFoundPage t={t} view={{ categories: await waysOn() }} />
}
