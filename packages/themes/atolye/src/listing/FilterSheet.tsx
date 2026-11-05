"use client"

import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import type { MouseEvent, ReactNode } from "react"

/** Under this width the filters live in the sheet; from it, in the side panel. */
const PHONE = "(max-width: 63.99rem)"

const dialogOf = (id: string) => {
  const found = document.getElementById(id)
  return found instanceof HTMLDialogElement ? found : null
}

/**
 * A link that opens the filter sheet: before the script, or with a
 * modifier, the anchor shows the sheet in place (`:target`).
 */
export function SheetOpener({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  return (
    <a
      href={`#${id}`}
      aria-haspopup="dialog"
      className={className}
      onClick={(event) => {
        const dialog = dialogOf(id)
        if (!dialog || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return
        }
        event.preventDefault()
        dialog.showModal()
      }}
    >
      {children}
    </a>
  )
}

/**
 * The filters on a phone: a sheet from the bottom of the screen (a modal
 * `<dialog>`: the focus stays inside, Escape and the scrim close it), the
 * panel scrolling between its head and a foot that clears every filter
 * and shows the results with their count. Each choice inside is a link
 * that narrows the list and carries the sheet's anchor, so on the new
 * page the sheet opens again with the new count on its button. Before
 * the script the anchor shows the same panel in place.
 */
export function FilterSheet({
  id,
  title,
  close,
  showResults,
  results,
  clear,
  children,
}: {
  id: string
  title: string
  /** The close button's name for a screen reader. */
  close: string
  /** "58 ürünü göster": closes the sheet onto the results. */
  showResults: string
  /** The results' anchor on the page. */
  results: string
  /** Every filter off, the sheet open again; none while nothing is on. */
  clear: { label: string; path: string } | null
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    dialog.dataset["ready"] = ""
    if (window.location.hash === `#${id}`) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`
      )
      if (window.matchMedia(PHONE).matches) {
        dialog.showModal()
      }
    }
    const wide = window.matchMedia(PHONE)
    const leave = () => {
      if (!wide.matches && dialog.open) {
        dialog.close()
      }
    }
    wide.addEventListener("change", leave)
    return () => {
      wide.removeEventListener("change", leave)
    }
  }, [id])

  const closeTo = (event: MouseEvent<HTMLAnchorElement>) => {
    const dialog = ref.current
    if (dialog?.open) {
      event.preventDefault()
      dialog.close()
      document.getElementById(results)?.scrollIntoView({ block: "start" })
    }
  }

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={`${id}-baslik`}
      className="gf-sheet"
      onClick={(event) => {
        // The scrim is the dialog itself: a press outside the panel closes it
        if (event.target === event.currentTarget) {
          event.currentTarget.close()
        }
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-4 py-2 pr-2 pl-4">
        <h2 id={`${id}-baslik`} className="text-title">
          {title}
        </h2>
        <a
          href={`#${results}`}
          aria-label={close}
          className="gf-icon-btn bg-paper-2"
          onClick={closeTo}
        >
          <X className="size-5" aria-hidden="true" strokeWidth={2} />
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-rule bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {clear ? (
          <a href={`${clear.path}#${id}`} rel="nofollow" className="gf-btn gf-btn--quiet">
            {clear.label}
          </a>
        ) : (
          <span />
        )}
        <a href={`#${results}`} className="gf-btn" onClick={closeTo}>
          {showResults}
        </a>
      </div>
    </dialog>
  )
}
