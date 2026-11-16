"use client"

import { Search } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"
import { OPEN_SEARCH_EVENT, askFrame } from "./events"

/**
 * The theme editor's way into a phone's dropping search (`SearchDrop`):
 * the live shop opens it from the bottom bar's "Ara", which a preview
 * does not draw (`bottomNavOf`: a preview is a frame in the panel, and the
 * editor's frame would turn the bar's links into page changes). Only in
 * the editor's live session (`shop.editor`) and under 1024 px, under
 * every header variant and search style; a live phone's header shows no
 * search at all (owner's request, 2026-11-16).
 */
export function SearchDropOpener({ label, className }: { label: string; className: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      data-search-drop-opener=""
      className={cn(className, "lg:hidden")}
      onClick={(event) => {
        // Safari gives a pressed button no focus: the dropping search takes it as the one to go back to
        event.currentTarget.focus({ preventScroll: true })
        askFrame(OPEN_SEARCH_EVENT)
      }}
    >
      <Search className="size-6" aria-hidden="true" strokeWidth={1.75} />
    </button>
  )
}
