import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "./confirm-dialog"

/**
 * Asks before throwing away what was typed: `guard(action)` runs the
 * action at once while nothing is unsaved, otherwise after "Değişiklikleri
 * at". Closing a form dialog and moving to the next record both go
 * through it.
 */
export function useDiscardGuard(dirty: boolean) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<(() => void) | null>(null)
  const guard = (action: () => void) => {
    if (dirty) {
      setPending(() => action)
    } else {
      action()
    }
  }
  const confirm = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPending(null)
        }
      }}
      title={t("formDialog.discardTitle")}
      description={t("formDialog.discardText")}
      confirmLabel={t("formDialog.discard")}
      destructive
      onConfirm={() => {
        const action = pending
        setPending(null)
        action?.()
      }}
    />
  )
  return { guard, confirm }
}
