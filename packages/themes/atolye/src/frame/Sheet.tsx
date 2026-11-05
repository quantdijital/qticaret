"use client"

import { X } from "lucide-react"
import { Dialog } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A sheet over the page: from the left (the menu) or the right (the
 * cart), full height, 400 px from 640 px, its inner edge rounded; on a
 * phone the cart takes the whole width and the menu leaves a 56 px strip
 * of the scrim, where the thumb closes it; a scrim behind, the focus held
 * inside, Escape and a 44 px button close it. It slides in 220 ms, at
 * once under reduced motion.
 */
export function Sheet({
  open,
  onOpenChange,
  side,
  title,
  description,
  closeLabel,
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
  onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"]
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-drawer=""
          {...(description ? {} : { "aria-describedby": undefined })}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed inset-y-0 z-(--z-modal) flex w-full flex-col bg-paper text-text shadow-float outline-none duration-(--dur-short) data-[state=closed]:animate-out data-[state=open]:animate-in sm:max-w-100",
            side === "left"
              ? "left-0 max-sm:w-[calc(100%-3.5rem)] max-sm:rounded-r-tile data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-r-tile"
              : "right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:rounded-l-tile"
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 pr-2 pl-4 sm:pl-6">
            <Dialog.Title className="max-w-none text-title">{title}</Dialog.Title>
            <Dialog.Close className="gf-icon-btn bg-paper-2" aria-label={closeLabel}>
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
