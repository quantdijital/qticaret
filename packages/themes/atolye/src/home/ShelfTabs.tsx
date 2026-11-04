"use client"

import { Children, useRef, useState, useSyncExternalStore } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

const noChange = () => () => undefined

/**
 * The shop's product sections in a row as tabs (docs/19 §6.5): every
 * panel is in the first HTML and, without script, each shows under its
 * own heading, one after another. Once the script runs, a tab row picks
 * one (arrow keys move along it) and the panels' own headings step back
 * for the screen reader only.
 */
export function ShelfTabs({
  id,
  label,
  tabs,
  children,
}: {
  id: string
  label: string
  tabs: readonly string[]
  children: ReactNode
}) {
  // False in the server's HTML and while hydrating, true once the script runs
  const ready = useSyncExternalStore(
    noChange,
    () => true,
    () => false
  )
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const panels = Children.toArray(children)
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (step === 0) {
      return
    }
    event.preventDefault()
    const next = (index + step + tabs.length) % tabs.length
    setActive(next)
    buttons.current[next]?.focus()
  }
  return (
    <div data-shelf-tabs={ready ? "on" : "off"} className="flex flex-col gap-8">
      <div
        role="tablist"
        aria-label={label}
        hidden={!ready}
        className="flex gap-6 overflow-x-auto border-b border-rule"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            id={`${id}-sekme-${String(index)}`}
            aria-selected={index === active}
            aria-controls={`${id}-panel-${String(index)}`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => {
              setActive(index)
            }}
            onKeyDown={(event) => {
              move(event, index)
            }}
            className={cn(
              "at-tab -mb-px min-h-11 border-b-2 text-lg font-medium whitespace-nowrap",
              index === active ? "border-rule-ink text-text" : "border-transparent text-text-2"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
      {panels.map((panel, index) => (
        <div
          key={tabs[index] ?? index}
          role={ready ? "tabpanel" : undefined}
          id={`${id}-panel-${String(index)}`}
          aria-labelledby={ready ? `${id}-sekme-${String(index)}` : undefined}
          hidden={ready && index !== active}
        >
          {panel}
        </div>
      ))}
    </div>
  )
}
