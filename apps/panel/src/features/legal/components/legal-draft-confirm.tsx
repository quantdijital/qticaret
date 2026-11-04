import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"

/** What can be done with a text's draft from its state card. */
export type DraftAction = "editPublished" | "discard" | "starter"

const L = "settings.legal"

/**
 * The question before a draft action loses something: the draft itself,
 * or the editor's unsaved changes, which every one of them throws away.
 */
export function DraftConfirm({
  action,
  hasDraft,
  hasPublished,
  dirty,
  onCancel,
  onConfirm,
}: {
  action: DraftAction | null
  hasDraft: boolean
  hasPublished: boolean
  dirty: boolean
  onCancel: () => void
  onConfirm: (action: DraftAction) => void
}) {
  const { t } = useTranslation()
  const shown = action ?? "discard"
  const description =
    shown === "discard"
      ? t(hasPublished ? `${L}.discard.text` : `${L}.discard.textNothingPublished`)
      : shown === "starter"
        ? t(hasDraft ? `${L}.starter.textDraft` : `${L}.starter.text`)
        : t(`${L}.editPublished.text`)
  return (
    <ConfirmDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={t(`${L}.${shown}.title`)}
      description={description}
      confirmLabel={t(`${L}.actions.${shown}`)}
      // Something written goes for good: the draft, or what the editor holds
      destructive={shown === "discard" || dirty || (shown === "starter" && hasDraft)}
      onConfirm={() => {
        onConfirm(shown)
      }}
    >
      {dirty ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t(`${L}.unsaved`)}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
