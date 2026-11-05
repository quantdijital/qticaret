"use client"

import { ChevronRight, CreditCard, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useState } from "react"
import type { InstallmentFamilyView, InstallmentSummaryView } from "@qticaret/ui"
import { InstallmentPlans } from "./InstallmentPlans"
import type { InstallmentWords } from "./words"

/** The program whose plan the line quoted: the summary's count at its monthly amount. */
const quoted = (families: InstallmentFamilyView[], summary: InstallmentSummaryView) =>
  families.find((family) =>
    family.options.some(
      (option) => option.count === summary.count && option.perInstallment === summary.perInstallment
    )
  )?.family ?? null

/**
 * The instalments under the price (owner 2026-11-05: no long table under
 * "add to cart"): one quiet line, "12 aya varan taksit · aylık 203,04
 * TL'den · Taksit seçenekleri", worked out on the server with the page;
 * the whole line opens the table. In a column under 480 px (a phone, a
 * tablet's half) it says "12 taksit · aylık 203,04 TL'den ›" and keeps to
 * one line, never breaking an amount from its "TL". The table is asked when it opens
 * (the variant chosen then), in a dialog from 640 px and a sheet from
 * the bottom on a phone: the focus held inside, Escape, the scrim and a
 * 44 px button close it, the focus goes back to the button.
 */
export function Installments({
  variantId,
  summary,
  load,
  words,
}: {
  variantId: string
  summary: InstallmentSummaryView
  load: (variantId: string) => Promise<InstallmentFamilyView[] | null>
  words: InstallmentWords
}) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState<{
    id: string
    families: InstallmentFamilyView[] | null
  } | null>(null)
  const shown = answer?.id === variantId ? answer.families : undefined

  const ask = () => {
    if (shown !== undefined) {
      return
    }
    const id = variantId
    load(id).then(
      (families) => {
        setAnswer({ id, families })
      },
      () => {
        setAnswer({ id, families: null })
      }
    )
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          ask()
        }
      }}
    >
      {/* The whole line opens the table; its 44 px target in padding over the seams */}
      <Dialog.Trigger
        data-installment-line=""
        className="group/taksit -my-3 flex max-w-full cursor-pointer flex-wrap items-center gap-x-2 self-start py-3 text-left text-sm"
      >
        <CreditCard className="size-4 shrink-0 text-text-2" aria-hidden="true" strokeWidth={1.75} />
        {/* A narrow column (a phone, a tablet's half) says it short and keeps one line */}
        <span className="font-semibold whitespace-nowrap @max-[30rem]:hidden">
          {words.upTo.replace("{count}", String(summary.count))}
        </span>
        <span className="font-semibold whitespace-nowrap @min-[30rem]:hidden">
          {words.short.replace("{count}", String(summary.count))}
        </span>
        <span aria-hidden="true" className="text-text-3">
          ·
        </span>
        <span className="tabular whitespace-nowrap text-text-2">
          {words.monthly.replace("{amount}", summary.perInstallment)}
        </span>
        <span className="font-semibold whitespace-nowrap underline decoration-text-3 underline-offset-[0.25em] group-hover/taksit:decoration-current @max-[30rem]:sr-only">
          {words.title}
        </span>
        <ChevronRight
          className="-ml-1 size-4 shrink-0 text-text-2 @min-[30rem]:hidden"
          aria-hidden="true"
          strokeWidth={2}
        />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          data-installments=""
          className="fixed inset-x-0 bottom-0 z-(--z-modal) flex max-h-[88dvh] flex-col rounded-t-tile bg-paper text-text shadow-float outline-none duration-(--dur-short) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-120 sm:rounded-tile sm:data-[state=open]:zoom-in-95"
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-4 pr-2 pl-5 sm:pl-6">
            <Dialog.Title className="max-w-none text-title">{words.title}</Dialog.Title>
            <Dialog.Close className="gf-icon-btn bg-paper-2" aria-label={words.close}>
              <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
            <div aria-live="polite" className="flex flex-col gap-4">
              {shown === undefined ? (
                <p className="min-h-40 text-sm text-text-2">{words.loading}</p>
              ) : shown === null || shown.length === 0 ? (
                <p className="text-sm text-text-2">{words.none}</p>
              ) : (
                <InstallmentPlans families={shown} first={quoted(shown, summary)} words={words} />
              )}
            </div>
            <Dialog.Description className="mt-4 text-xs text-text-2">
              {words.note}
            </Dialog.Description>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
