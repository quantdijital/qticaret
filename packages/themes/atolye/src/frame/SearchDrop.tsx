"use client"

import { X } from "lucide-react"
import { Dialog } from "radix-ui"
import { useEffect, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { OPEN_SEARCH_EVENT } from "./events"
import { LayerPortal } from "./Layers"
import { SearchBox } from "./SearchBox"
import { PHONE_SEARCH } from "./SearchLink"

type BoxProps = Omit<ComponentProps<typeof SearchBox>, "id" | "className" | "onLeave">

/**
 * A phone's search when the header's is an icon (`search_style: icon`,
 * adr/0049 Ek 2026-11-15): the header draws no box under 1024 px; the
 * bottom bar's "Ara" (`qt:open-search`) drops this one down from the top,
 * the whole width, in 220 ms (at once under reduced motion), a scrim
 * under it. The field has the cursor at once (the keyboard opens), the
 * live panel answers under it; the 44 px X, Escape or a press on the scrim
 * close it, and the focus goes back to "Ara". Nothing without script:
 * "Ara" is then a link to the search page.
 */
export function SearchDrop({
  title,
  closeLabel,
  ...box
}: BoxProps & {
  /** The layer's name for a screen reader: "Arama". */
  title: string
  /** "Aramayı kapat". */
  closeLabel: string
}) {
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const show = (event: Event) => {
      event.preventDefault()
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setOpen(true)
    }
    window.addEventListener(OPEN_SEARCH_EVENT, show)
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, show)
    }
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <LayerPortal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-scrim duration-(--dur-short) data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
        <Dialog.Content
          data-search-drop=""
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // The field first, not the close button: the keyboard opens on it
            event.preventDefault()
            document.getElementById(PHONE_SEARCH)?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
            opener.current = null
          }}
          className="fixed inset-x-0 top-0 z-(--z-modal) flex items-center gap-2 rounded-b-tile bg-paper px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 text-text shadow-float outline-none duration-(--dur-short) data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top data-[state=open]:animate-in data-[state=open]:slide-in-from-top lg:hidden"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <SearchBox {...box} id={PHONE_SEARCH} className="min-w-0 flex-1" />
          <Dialog.Close className="gf-icon-btn shrink-0 bg-paper-2" aria-label={closeLabel}>
            <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
          </Dialog.Close>
        </Dialog.Content>
      </LayerPortal>
    </Dialog.Root>
  )
}
