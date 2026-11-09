import type { ComponentProps, ReactNode } from "react"
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog"
import type { DialogPane, DialogSize } from "@/components/ui/dialog"
import { DialogHeading } from "./dialog-heading"

interface DetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** The description's own type (an action name or a path in monospace). */
  descriptionClassName?: string
  size?: DialogSize
  /** Header and footer fixed, the body scrolling between them; `"fixed"` also holds its height. */
  pane?: DialogPane
  /** Right of the title, clear of the close button: a record's ‹ n / m ›. */
  headerAction?: ReactNode
  /** The record's own actions (delete, mark as answered); none, no footer. */
  footer?: ReactNode
  /** Asked before the dialog closes (a field typed and not saved). */
  onCloseRequest?: (close: () => void) => void
  className?: string
  onOpenAutoFocus?: ComponentProps<typeof DialogContent>["onOpenAutoFocus"]
  /** The body: `DialogBody`, or tabs with a `DialogBody` each. */
  children: ReactNode
}

/**
 * One record in full, opened from its list (docs/18 §7; the owner,
 * 2026-11-06: one standard dialog, never a side sheet): its facts, the
 * parts that save on their own, its actions in the footer, and ‹ n / m ›
 * to walk the list without closing. A form that saves as one goes in
 * `FormDialog` instead.
 */
export function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  descriptionClassName,
  size = "md",
  pane = false,
  headerAction,
  footer,
  onCloseRequest,
  className,
  onOpenAutoFocus,
  children,
}: DetailDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true)
        } else if (onCloseRequest) {
          onCloseRequest(() => {
            onOpenChange(false)
          })
        } else {
          onOpenChange(false)
        }
      }}
    >
      <DialogContent
        size={size}
        pane={pane}
        className={className}
        {...(onOpenAutoFocus ? { onOpenAutoFocus } : {})}
      >
        <DialogHeading
          title={title}
          description={description}
          descriptionClassName={descriptionClassName}
          action={headerAction}
        />
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
