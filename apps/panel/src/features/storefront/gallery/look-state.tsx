import { useTranslation } from "react-i18next"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"

const G = "storefront.gallery.badge"

/**
 * A look's one state, said once: live wins (where the draft stands is the
 * "Şu anki görünüm" bar's to say), else in the draft (and changed there),
 * else nothing; a newer version beside it when there is one.
 */
export function LookState({
  live,
  inDraft,
  edited = false,
  newer = false,
}: {
  live: boolean
  inDraft: boolean
  edited?: boolean
  newer?: boolean
}) {
  const { t } = useTranslation()
  if (!live && !inDraft && !newer) {
    return null
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {live ? (
        <StatusBadge tone="success">{t(`${G}.live`)}</StatusBadge>
      ) : inDraft ? (
        <StatusBadge tone="info">
          {edited ? `${t(`${G}.draft`)}, ${t(`${G}.edited`)}` : t(`${G}.draft`)}
        </StatusBadge>
      ) : null}
      {newer ? <StatusBadge tone="warning">{t(`${G}.newVersion`)}</StatusBadge> : null}
    </span>
  )
}
