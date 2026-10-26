import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { ContentStatus } from "@/features/content/api/content"

/** Live or draft, as the lists and the page header show it. */
export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const { t } = useTranslation()
  return (
    <StatusBadge tone={status === "published" ? "success" : "neutral"}>
      {t(`content.status.${status}`)}
    </StatusBadge>
  )
}
