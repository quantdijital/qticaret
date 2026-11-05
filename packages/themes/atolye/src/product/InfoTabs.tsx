"use client"

import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"

export interface InfoTab {
  /** The panel's id (its tab is `{id}-sekme`). */
  id: string
  /** The panel's own heading's id, kept for links and the outline. */
  headingId: string
  title: string
  content: ReactNode
}

/**
 * The description and the specs as two tabs (sahip 2026-11-05), the
 * WAI-ARIA pattern: a tablist whose arrow keys, Home and End move and
 * choose, each panel labelled by its tab and reached with Tab. Without
 * the script both panels stand one under the other with their own
 * headings and no tabs (`tabs.css`, `scripting: none`); with it the
 * stylesheet shows the first panel from the first paint, so nothing
 * moves when the script arrives. A link to a heading in the other panel
 * opens that panel.
 */
export function InfoTabs({ label, tabs }: { label: string; tabs: InfoTab[] }) {
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const hydrated = useHydrated()

  useEffect(() => {
    const follow = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1))
      const at = tabs.findIndex((tab) => tab.id === hash || tab.headingId === hash)
      if (at !== -1) {
        setActive(at)
      }
    }
    follow()
    window.addEventListener("hashchange", follow)
    return () => {
      window.removeEventListener("hashchange", follow)
    }
  }, [tabs])

  const choose = (to: number) => {
    const next = (to + tabs.length) % tabs.length
    setActive(next)
    buttons.current[next]?.focus()
  }

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    const to = moves[event.key]
    if (to !== undefined) {
      event.preventDefault()
      choose(to)
    }
  }

  return (
    <div className="gf-info flex flex-col gap-6 lg:gap-8">
      <div role="tablist" aria-label={label} className="gf-info-tabs" onKeyDown={keys}>
        {tabs.map((tab, n) => (
          <button
            key={tab.id}
            ref={(button) => {
              buttons.current[n] = button
            }}
            type="button"
            role="tab"
            id={`${tab.id}-sekme`}
            aria-selected={n === active}
            aria-controls={tab.id}
            tabIndex={n === active ? 0 : -1}
            className="gf-info-tab"
            onClick={() => {
              setActive(n)
            }}
          >
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, n) => (
        <section
          key={tab.id}
          id={tab.id}
          role="tabpanel"
          aria-labelledby={`${tab.id}-sekme`}
          tabIndex={0}
          data-inactive={n === active ? undefined : ""}
          hidden={hydrated && n !== active}
          className="flex min-w-0 scroll-mt-40 flex-col gap-5"
        >
          <h2 id={tab.headingId} className="gf-info-head text-section">
            {tab.title}
          </h2>
          {tab.content}
        </section>
      ))}
    </div>
  )
}
