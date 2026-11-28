"use client"

import type { MouseEvent, ReactNode } from "react"

/**
 * A search box cell around a select. A label only focuses its select, it
 * never opens it, and the select is one short line of the cell: a press on
 * the icon, the caption or the padding opened nothing (owner 2026-11-28).
 * Here the whole cell opens the list.
 */
export function PickerLabel({ className, children }: { className: string; children: ReactNode }) {
  const open = (event: MouseEvent<HTMLLabelElement>) => {
    const select = event.currentTarget.querySelector("select")
    if (!select || event.target === select) return
    try {
      select.showPicker()
    } catch {
      select.focus()
    }
  }
  return (
    <label className={className} onClick={open}>
      {children}
    </label>
  )
}
