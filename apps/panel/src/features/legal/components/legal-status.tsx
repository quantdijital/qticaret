import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { LegalVersion } from "@/features/legal/api"

/** Whether the text is in force (and which version), and whether a draft waits. */
export function LegalStatus({
  published,
  draft,
}: {
  published: LegalVersion | null
  draft: LegalVersion | null
}) {
  const { t } = useTranslation()
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {published ? (
        <StatusBadge tone="success">
          {t("settings.legal.status.published", { version: published.version })}
        </StatusBadge>
      ) : (
        <StatusBadge tone="warning">{t("settings.legal.status.none")}</StatusBadge>
      )}
      {draft ? <StatusBadge tone="info">{t("settings.legal.status.draft")}</StatusBadge> : null}
    </span>
  )
}
