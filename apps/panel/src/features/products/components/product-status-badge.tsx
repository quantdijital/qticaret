import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { formatPublishAt } from "@/features/products/publish-schedule"

/**
 * Published (green) or not yet in the shop (grey); a draft with a planned
 * publish (S2) says when: "Planlı · 28 Kas 10:00".
 */
export function ProductStatusBadge({
  status,
  publishAt = null,
}: {
  status: string
  publishAt?: string | null | undefined
}) {
  const { t } = useTranslation()
  if (status === "draft" && publishAt) {
    return (
      <StatusBadge tone="info">
        {t("products.status.scheduled", { at: formatPublishAt(publishAt) })}
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone={status === "published" ? "success" : "neutral"}>
      {t(`products.status.${status === "published" ? "published" : "draft"}`)}
    </StatusBadge>
  )
}
