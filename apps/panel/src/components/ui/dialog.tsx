import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * The panel's dialog box (docs/18 §4.3). Its one column never grows past
 * the box (`minmax(0,1fr)`): a long name that truncates stays inside
 * instead of pushing every row out of the dialog. From `sm` up it is at
 * most `--dialog-max-height` (85% of the screen) tall and scrolls inside,
 * its footer pinned at the bottom (the owner, 2026-11-05: "o modal niye
 * bu kadar yüksek?"). On a phone it is
 * a sheet from the bottom edge, as tall as its content and at most the
 * whole screen, so its actions stay in reach. Header, body and footer sit
 * 24 px apart inside 24 px (phone) or 32 px of padding (the owner,
 * 2026-11-03: "biraz yüksekliğini artırarak daha ferah").
 */
export const DIALOG_CONTENT_CLASS =
  "fixed inset-x-0 bottom-0 z-50 grid max-h-dvh w-full grid-cols-[minmax(0,1fr)] gap-6 overflow-y-auto overscroll-contain rounded-t-lg border-t bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:inset-x-auto sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-h-(--dialog-max-height) sm:w-[calc(100%-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-8"

/**
 * How wide a dialog is from `sm` up (tokens `--dialog-width-*`): `sm` a
 * confirm or a short form, `md` a form or a list of lines, `lg` a table
 * or two columns, `xl` a wide picker or a preview.
 */
export const DIALOG_SIZE_CLASS = {
  sm: "sm:max-w-(--dialog-width-sm)",
  md: "sm:max-w-(--dialog-width-md)",
  lg: "sm:max-w-(--dialog-width-lg)",
  xl: "sm:max-w-(--dialog-width-xl)",
} as const

export type DialogSize = keyof typeof DIALOG_SIZE_CLASS

/**
 * `pane`: the header and the footer stay where they are and only the body
 * scrolls (a picker's grid, a long list), the box at its full height so a
 * tab or a page of results does not make it jump.
 */
export const DIALOG_PANE_CLASS =
  "group/pane flex flex-col overflow-hidden sm:h-(--dialog-max-height)"

/** The body of a `pane` dialog: what scrolls, running to the box's edges so its scrollbar does. */
export const DIALOG_PANE_BODY_CLASS =
  "group-data-[pane]/pane:-mx-6 group-data-[pane]/pane:min-h-0 group-data-[pane]/pane:flex-1 group-data-[pane]/pane:overflow-y-auto group-data-[pane]/pane:overscroll-contain group-data-[pane]/pane:px-6 sm:group-data-[pane]/pane:-mx-8 sm:group-data-[pane]/pane:px-8"

/** Pinned to the box's bottom edge over what scrolls under it; the box's own padding kept around it. */
export const DIALOG_FOOTER_CLASS =
  "sticky -bottom-6 z-10 -mx-6 -mt-4 -mb-6 flex flex-col-reverse gap-2 bg-background px-6 pt-4 pb-6 sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:flex-row sm:justify-end sm:px-8 sm:pb-8"

/** The close button in the box's corner, level with the title. */
export const DIALOG_CLOSE_CLASS =
  "absolute top-4 right-4 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none sm:top-6 sm:right-6 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

function DialogContent({
  className,
  children,
  size = "md",
  pane = false,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: DialogSize
  /** Header and footer fixed, the body scrolling between them (`DIALOG_PANE_CLASS`). */
  pane?: boolean
  showCloseButton?: boolean
}) {
  const { t } = useTranslation()
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size}
        data-pane={pane ? "" : undefined}
        className={cn(
          DIALOG_CONTENT_CLASS,
          DIALOG_SIZE_CLASS[size],
          pane && DIALOG_PANE_CLASS,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" className={DIALOG_CLOSE_CLASS}>
            <XIcon />
            <span className="sr-only">{t("common.close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      // Clear of the close button in the corner
      className={cn("flex flex-col gap-2 px-6 text-center sm:px-0 sm:pr-6 sm:text-left", className)}
      {...props}
    />
  )
}

/**
 * What sits between the header and the footer, its parts 20 px apart.
 * `list`: a dialog over a list of lines, held at a calm height from `sm`
 * up so a one-line list does not leave a strip. In a `pane` dialog it is
 * the part that scrolls.
 */
function DialogBody({
  className,
  list = false,
  ...props
}: React.ComponentProps<"div"> & { list?: boolean }) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "flex min-w-0 flex-col gap-5",
        list && "sm:min-h-44",
        DIALOG_PANE_BODY_CLASS,
        className
      )}
      {...props}
    />
  )
}

/** A titled part of a long dialog: what the lines below are, in a word or two. */
function DialogSection({
  title,
  description,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <section
      data-slot="dialog-section"
      className={cn("flex min-w-0 flex-col gap-3", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div
      data-slot="dialog-footer"
      // A pane's footer under what scrolls: a line between them
      className={cn(DIALOG_FOOTER_CLASS, "group-data-[pane]/pane:border-t", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{t("common.close")}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-snug font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogSection,
  DialogTitle,
  DialogTrigger,
}
