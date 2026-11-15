import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogFooter } from "../ui/dialog"
import type { DialogPane, DialogSize } from "../ui/dialog"
import { DialogHeading } from "./dialog-heading"
import { useDiscardGuard } from "./use-discard-guard"

/** What may take the caret on opening: a control, never a box around one. */
const FOCUSABLE =
  'a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** The description's own type (a path in monospace). */
  descriptionClassName?: string
  size?: DialogSize
  /** Header and footer fixed, the body scrolling between them; `"fixed"` also holds its height. */
  pane?: DialogPane
  /** Right of the title, clear of the close button: a record's previous/next. */
  headerAction?: ReactNode
  dirty: boolean
  saving: boolean
  onSubmit: () => void
  /** The parent's guard, when it also guards moving to another record. */
  guard?: ReturnType<typeof useDiscardGuard>
  /** The element (by id) the caret goes to on opening, in place of the first field. */
  initialFocus?: string | null
  /** The submit button's words in place of "Kaydet" (`Yanıtla`). */
  submitLabel?: string
  /** Whether what is typed may be sent at all (within its limits); with `dirty`, it lights "Kaydet". */
  canSubmit?: boolean
  /** A footer action of its own on the left, apart from the two (`Yanıtı sil`). */
  footerStart?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * A form in a dialog (docs/18 §7): its fields in the body, "Vazgeç" and
 * "Kaydet" in the footer, "Kaydet" live once something changed. Closing
 * it with an unsaved change (the close button, Escape, a click outside,
 * "Vazgeç") asks first.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  descriptionClassName,
  size = "md",
  pane = false,
  headerAction,
  dirty,
  saving,
  onSubmit,
  guard,
  initialFocus,
  submitLabel,
  canSubmit = true,
  footerStart,
  className,
  children,
}: FormDialogProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const own = useDiscardGuard(dirty)
  const { guard: ask, confirm } = guard ?? own
  const close = () => {
    ask(() => {
      onOpenChange(false)
    })
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true)
          } else if (!saving) {
            close()
          }
        }}
      >
        <DialogContent
          size={size}
          pane={pane}
          className={className}
          onOpenAutoFocus={(event) => {
            const target = initialFocus ? document.getElementById(initialFocus) : null
            // A field's box (a picture's) is not focusable itself: its first control is
            const control = target?.matches(FOCUSABLE)
              ? target
              : target?.querySelector<HTMLElement>(FOCUSABLE)
            if (control) {
              event.preventDefault()
              control.focus()
            }
          }}
        >
          <form
            noValidate
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              onSubmit()
            }}
          >
            <DialogHeading
              title={title}
              description={description}
              descriptionClassName={descriptionClassName}
              action={headerAction}
            />
            {children}
            <DialogFooter>
              {footerStart ? <div className="flex sm:mr-auto">{footerStart}</div> : null}
              <Button type="button" variant="outline" disabled={saving} onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!dirty || !canSubmit || saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {submitLabel ?? t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirm}
    </>
  )
}
