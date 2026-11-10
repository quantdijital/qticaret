import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

/**
 * A notice in the page (docs/18 §2 "İkon ve metin"). Three columns: the
 * icon, the words, the actions. The icon's box is one line of the text
 * tall (`h-lh`, 20 px) and draws its 16 px glyph in the middle, so it
 * sits level with the first line whether the words run to one line or
 * five, a title or not (the owner, 2026-11-09: "ikon ile metin yatayda
 * hizalanmamış"). An `AlertAction` is centred on that same first line;
 * on a phone it goes under the words.
 */
const alertVariants = cva(
  "group/alert relative grid w-full grid-cols-[0_minmax(0,1fr)_auto] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm leading-5 has-[>svg]:grid-cols-[calc(var(--spacing)*7)_minmax(0,1fr)_auto] has-[>[data-slot=alert-action]]:py-3.5 [&>svg]:col-start-1 [&>svg]:row-start-1 [&>svg]:h-lh [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 line-clamp-1 min-h-5 font-medium tracking-tight", className)}
      {...props}
    />
  )
}

/** The words; every line in them 20 px, the icon's line. */
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm leading-5 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * The notice's buttons (32 px, `size="sm"`), right of the words and
 * centred on their first line: 6 px above and below that 20 px line.
 */
function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "col-start-2 row-start-auto mt-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:row-start-1 sm:-my-1.5 sm:ml-4",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
