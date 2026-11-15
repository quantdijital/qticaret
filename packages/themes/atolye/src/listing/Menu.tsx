"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A small menu that floats under its pill: a `<details>`, so it opens
 * without the script; with it, Escape, a press outside or leaving it by
 * keyboard closes it, and Escape gives the focus back to the pill.
 */
export function Menu({
  label,
  className,
  align = "end",
  children,
}: {
  /** The pill's words ("Sırala: Önerilen"). */
  label: ReactNode
  className?: string
  align?: "start" | "end"
  children: ReactNode
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const menu = ref.current
    if (!menu) {
      return
    }
    const away = (event: PointerEvent) => {
      if (menu.open && !menu.contains(event.target as Node)) {
        menu.open = false
      }
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.open) {
        menu.open = false
        menu.querySelector("summary")?.focus()
      }
    }
    const blur = (event: FocusEvent) => {
      if (menu.open && !menu.contains(event.relatedTarget as Node | null)) {
        menu.open = false
      }
    }
    document.addEventListener("pointerdown", away)
    menu.addEventListener("keydown", key)
    menu.addEventListener("focusout", blur)
    return () => {
      document.removeEventListener("pointerdown", away)
      menu.removeEventListener("keydown", key)
      menu.removeEventListener("focusout", blur)
    }
  }, [])
  return (
    <details ref={ref} data-menu="" className={cn("group/menu relative", className)}>
      <summary className="gf-chip w-full cursor-pointer justify-center gap-2 rounded-button bg-paper-2">
        {label}
        <ChevronDown
          className="size-4 shrink-0 transition-transform duration-(--dur-short) group-open/menu:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        className={cn(
          "absolute top-[calc(100%+var(--space-xs))] z-(--z-dropdown) min-w-56 rounded-tile border border-rule bg-field p-2 shadow-float",
          align === "end" ? "right-0" : "left-0"
        )}
      >
        {children}
      </div>
    </details>
  )
}
