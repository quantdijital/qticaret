import type { ReactNode } from "react"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface DialogHeadingProps {
  title: ReactNode
  description?: ReactNode
  /** The description's own type (a path or an action name in monospace). */
  descriptionClassName?: string | undefined
  /** Right of the title, clear of the close button: a record's previous/next. */
  action?: ReactNode
}

/**
 * A dialog's title and the line under it, with a record's ‹ n / m › on
 * the right (docs/18 §7). Without a description the title is also the
 * description, for screen readers only.
 */
export function DialogHeading({
  title,
  description,
  descriptionClassName,
  action,
}: DialogHeadingProps) {
  return (
    <DialogHeader className={cn(action && "sm:flex-row sm:items-start sm:pr-10")}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <DialogTitle className="break-words">{title}</DialogTitle>
        {description ? (
          <DialogDescription
            asChild={typeof description !== "string"}
            className={descriptionClassName}
          >
            {typeof description === "string" ? description : <div>{description}</div>}
          </DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{title}</DialogDescription>
        )}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center justify-center gap-1">{action}</div>
      ) : null}
    </DialogHeader>
  )
}
