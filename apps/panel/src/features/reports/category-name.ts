import { useTranslation } from "react-i18next"
import type { DashboardOverview } from "@/features/dashboard/api/overview"

type Category = DashboardOverview["categories"][number]

/** A category's name; sales outside any category and the rest of a long list have their own. */
export function useCategoryName() {
  const { t } = useTranslation()
  return (row: Category): string =>
    row.kind === "category"
      ? (row.name ?? "")
      : t(`dashboard.categories.${row.kind === "other" ? "other" : "uncategorized"}`)
}
