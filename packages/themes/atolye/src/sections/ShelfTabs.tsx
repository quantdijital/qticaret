import { Children } from "react"
import type { ReactNode } from "react"

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
  children,
}: {
  id: string
  label: string
  tabs: readonly string[]
  children: ReactNode
}) {
  const panels = Children.toArray(children)
  return (
    <div className="gf-tabs flex flex-col gap-6">
      <fieldset className="gf-tab-row min-w-0 border-0 p-0">
        <legend className="sr-only">{label}</legend>
        <div className="gf-rail -mx-(--gutter) flex scroll-px-(--gutter) gap-2 overflow-x-auto px-(--gutter) py-1">
          {tabs.map((tab, index) => (
            <label key={tab} className="gf-tab">
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
