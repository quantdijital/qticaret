"use client"

import { Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ComponentProps, FocusEvent } from "react"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { cn } from "@qticaret/ui/lib/utils"
import { SearchBox } from "./SearchBox"

type BoxProps = Omit<ComponentProps<typeof SearchBox>, "className" | "onLeave">

/**
 * The header's search as a magnifier (`search_style: icon`, adr/0049 Ek
 * 2026-11-15), from 1024 px: a 44 px button that opens the search box
 * beside it, growing out of the button in 220 ms (at once under reduced
 * motion, `search-toggle.css`) to the width the header gives it
 * (`--gf-search-open`): to the right where it stands at the row's start
 * (`align: start`, the centred header), to the left beside the tools
 * (`end`). Opened, the field takes the focus and works as the open box
 * does (the live panel, the arrow keys); Escape (the panel first) closes
 * it and gives the focus back to the button, a press outside or the focus
 * leaving closes it too. Without script, a link to the search page.
 */
export function SearchToggle({
  align,
  openLabel,
  className,
  ...box
}: BoxProps & {
  align: "start" | "end"
  /** The button's name: "Aramayı aç". */
  openLabel: string
  /** Where it stands in the row and how wide it opens (`[--gf-search-open:…]`). */
  className?: string
}) {
  const hydrated = useHydrated()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const fieldId = `${box.id}-kutu`

  // Opened, the cursor goes in the field (shown before this runs: the style says so at once)
  useEffect(() => {
    if (open) {
      document.getElementById(box.id)?.focus()
    }
  }, [open, box.id])

  // A press anywhere outside the button and the box closes it
  useEffect(() => {
    if (!open) {
      return
    }
    const press = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", press)
    return () => {
      document.removeEventListener("pointerdown", press)
    }
  }, [open])

  // The keyboard moving on past the box closes it (not a window losing the focus)
  const blur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) {
      setOpen(false)
    }
  }

  const icon = <Search className="size-6" aria-hidden="true" strokeWidth={1.75} />
  return (
    <div
      ref={root}
      data-search-toggle={align}
      data-open={open ? "" : undefined}
      className={cn("gf-search-toggle", className)}
      onBlur={blur}
    >
      {hydrated ? (
        <button
          ref={button}
          type="button"
          aria-label={openLabel}
          aria-expanded={open}
          aria-controls={fieldId}
          className="gf-icon-btn gf-tool"
          onClick={() => {
            setOpen(true)
          }}
        >
          {icon}
        </button>
      ) : (
        <a href="/arama" aria-label={openLabel} className="gf-icon-btn gf-tool">
          {icon}
        </a>
      )}
      <div id={fieldId} className="gf-search-toggle__box">
        <SearchBox
          {...box}
          onLeave={() => {
            setOpen(false)
            button.current?.focus()
          }}
        />
      </div>
    </div>
  )
}
