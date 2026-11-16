import { Children } from "react"
import type { ReactNode } from "react"
import { ShelfTabsFollow } from "./ShelfTabsFollow"
import { ShelfTabsReveal } from "./ShelfTabsReveal"

/**
 * The shop's product sections in a row as tabs, with no script: a group
 * of radio buttons drawn as pills (arrow keys move along them, as any
 * radio group's do) and every panel in the HTML; the stylesheet shows the
 * panel whose pill is checked (`tabs.css`). Nothing moves when
 * the page's script arrives. A browser without `:has()` shows every
 * panel, one after another, and no pills.
 */
export function ShelfTabs({
  id,
  label,
  tabs,
  keys,
  children,
}: {
  id: string
  label: string
  tabs: readonly string[]
  /** Each pill's field key, in the theme editor's live preview only (adr/0065 Faz 2b). */
  keys?: readonly string[] | undefined
  children: ReactNode
}) {
  const panels = Children.toArray(children)
  return (
    <div className="gf-tabs flex flex-col gap-(--head-gap-s)">
      <ShelfTabsReveal />
      <ShelfTabsFollow />
      <fieldset className="gf-tab-row min-w-0 border-0 p-0">
        <legend className="sr-only">{label}</legend>
        {/* One line of pills that scrolls sideways, past the container to the
            screen's edges, the first pill on the page's left line; below
            1024 px a cut edge fades while more waits (`tabs-rail.css`,
            owner 2026-11-16) */}
        <div className="gf-rail -mx-(--gutter) flex gap-(--space-xs) overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1">
          {tabs.map((tab, index) => (
            <label
              key={tab}
              className="gf-tab"
              {...(keys?.[index] ? { "data-qf": keys[index] } : {})}
            >
              <input
                type="radio"
                name={`${id}-raf`}
                value={String(index)}
                defaultChecked={index === 0}
              />
              {tab}
            </label>
          ))}
        </div>
      </fieldset>
      {panels.map((panel, index) => (
        <div key={tabs[index] ?? index} data-panel={String(index)}>
          {panel}
        </div>
      ))}
    </div>
  )
}
