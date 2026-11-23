import { useQuery } from "@tanstack/react-query"
import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { liveCollectionsQuery } from "@/features/collections/api/flag"

const P = "settings.features.collectionsOff"

/**
 * Asks before collections go off (a warning, not a block): with live
 * collection pages it names how many, says their addresses answer 404 and
 * may lose their places in search; the records stay, and turning the flag
 * back on brings the pages back.
 */
export function CollectionsOffConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const live = useQuery(liveCollectionsQuery()).data ?? 0
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      confirmLabel={t(`${P}.confirm`)}
      onConfirm={onConfirm}
    >
      {live > 0 ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-text"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`${P}.live`, { count: live })}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
