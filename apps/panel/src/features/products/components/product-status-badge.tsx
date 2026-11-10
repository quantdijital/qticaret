import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"

/** Published (green) or not yet in the shop (grey). */
export function ProductStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <StatusBadge tone={status === "published" ? "success" : "neutral"}>
      {t(`products.status.${status === "published" ? "published" : "draft"}`)}
    </StatusBadge>
  )
}
