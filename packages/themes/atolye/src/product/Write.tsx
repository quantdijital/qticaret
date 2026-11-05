"use client"

import { X } from "lucide-react"
import { Dialog } from "radix-ui"
import type { ReactNode } from "react"

/**
 * "Değerlendirme yaz" and "Soru sor" (owner 2026-11-06: the form open on
 * the page beside a thin "no reviews yet" strip looked lopsided): one
 * button that opens the form in a dialog from 640 px and a sheet from the
 * bottom on a phone, as the instalments' table does. The focus is held
 * inside; Escape, the scrim and a 44 px button close it, the focus goes
 * back to the button. The form is the caller's (`children`).
 */
export function WriteDialog({
  label,
  title,
  note,
  close,
  icon,
  className,
  children,
}: {
  label: string
  title: string
  /** One line under the title: what happens to what they send. */
  note: string
  close: string
  icon?: ReactNode
  className: string
  children: ReactNode
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={className}>
        {icon}
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-write=""
          className="fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[88dvh] flex-col rounded-t-tile bg-paper text-text shadow-float outline-none duration-(--dur-short) motion-safe:data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:animate-in data-[state=open]:fade-in-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-140 sm:rounded-tile sm:data-[state=open]:zoom-in-95"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 pt-3 pr-2 pl-5 sm:pl-6">
            <div className="flex min-w-0 flex-col gap-1 pt-2">
              <Dialog.Title className="max-w-none text-title">{title}</Dialog.Title>
              <Dialog.Description className="text-sm text-text-2">{note}</Dialog.Description>
            </div>
            <Dialog.Close className="gf-icon-btn shrink-0 bg-paper-2" aria-label={close}>
              <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The dialog's own way out after the form is sent: a quiet "Kapat". */
export function DoneButton({ label }: { label: string }) {
  return (
    <Dialog.Close className="gf-btn gf-btn--quiet w-full sm:w-auto sm:self-start">
      {label}
    </Dialog.Close>
  )
}
