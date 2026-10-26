import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { ORIGINALITY } from "@/features/content/api/landings"

/** How much of a landing page's text is its own: under 30% it cannot go live, under 40% it warns. */
export function OriginalityBadge({ value }: { value: number }) {
  const { t } = useTranslation()
  const tone =
    value < ORIGINALITY.block ? "danger" : value < ORIGINALITY.warn ? "warning" : "success"
  return <StatusBadge tone={tone}>{t("content.landing.percent", { value })}</StatusBadge>
}
