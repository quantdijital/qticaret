import { useBlocker } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "./confirm-dialog"

/**
 * Asks before leaving a form with unsaved changes (docs/06 §6): in the
 * panel with a dialog, when the tab closes with the browser's own prompt.
 */
export function LeaveGuard({ when }: { when: boolean }) {
  const { t } = useTranslation()
  const blocker = useBlocker({
    shouldBlockFn: () => when,
    enableBeforeUnload: () => when,
    withResolver: true,
  })
  return (
    <ConfirmDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open) {
          blocker.reset?.()
        }
      }}
      title={t("leave.title")}
      description={t("leave.description")}
      confirmLabel={t("leave.confirm")}
      destructive
      onConfirm={() => {
        blocker.proceed?.()
      }}
    />
  )
}
