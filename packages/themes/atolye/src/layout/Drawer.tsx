"use client"

import { X } from "lucide-react"
import { Dialog } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A drawer over the page (design.md § Components): from the left (the
 * menu) or the right (the cart), full height, the whole width of a phone;
 * a scrim behind, the focus held inside, Escape and a 44 px button close
 * it. It slides in 220 ms, at once under reduced motion; no shadow on the
 * page, one overlay shadow on the drawer.
 */
export function Drawer({
  open,
  onOpenChange,
  side,
  title,
  description,
  closeLabel,
  className,
  onCloseAutoFocus,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: "left" | "right"
  title: ReactNode
  /** Read to a screen reader with the title; none: the title says it all. */
  description?: string
  closeLabel: string
  className?: string
  onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"]
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-drawer=""
          // Radix ties the description in by itself; without one, nothing is described
          {...(description ? {} : { "aria-describedby": undefined })}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed inset-y-0 z-(--z-modal) flex w-full flex-col bg-paper text-text shadow-overlay outline-none duration-(--dur-short) data-[state=closed]:animate-out data-[state=open]:animate-in",
            side === "left"
              ? "left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm"
              : "right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[420px]",
            className
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b-2 border-rule-ink pl-4 sm:pl-6">
            <Dialog.Title className="max-w-none font-body text-title font-medium tracking-normal">
              {title}
            </Dialog.Title>
            <Dialog.Close className="at-icon-btn" aria-label={closeLabel}>
              <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          {description && (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
