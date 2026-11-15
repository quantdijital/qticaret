import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useReturnFocus } from "../hooks/use-return-focus"
import { ADMIN_UI_NS } from "../i18n"
import { cn } from "../lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Names the action ("Siparişi iptal et"), never just "Tamam" (docs/06 §6). */
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  /** What else to know before deciding, under the description. */
  children?: ReactNode
}

/** Asks before an action that cannot be taken back. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const onCloseAutoFocus = useReturnFocus(open)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
