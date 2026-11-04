import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { ORIGINALITY } from "@/features/content/api/landings"

/** How much of a landing page's text is its own: red under 30%, a warning under 40%. */
export function OriginalityBadge({ value }: { value: number }) {
  const { t } = useTranslation()
  const tone = value < ORIGINALITY.low ? "danger" : value < ORIGINALITY.warn ? "warning" : "success"
  return <StatusBadge tone={tone}>{t("content.landing.percent", { value })}</StatusBadge>
}
