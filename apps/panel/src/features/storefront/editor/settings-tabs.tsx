import { useContext, useRef } from "react"
import type { KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { tabId, tabTitle } from "./panel-groups"
import { SettingsLayoutContext } from "./settings-layout-state"

/**
 * The panel's tabs, "İçerik", "Stil", "Gelişmiş" (adr/0065 Ek, sekmeler),
 * as the WAI-ARIA tabs pattern has them: one tab in the Tab order, the
 * arrows, Home and End moving between them and showing each at once. The
 * groups of every tab stay drawn in one panel, the others' hidden, so a
 * field elsewhere is still there to be found and taken to. Held under the
 * panel's header while it scrolls.
 */
export function SettingsTabs({ base }: { base: string }) {
  const { t } = useTranslation()
  const layout = useContext(SettingsLayoutContext)
  const list = useRef<HTMLDivElement>(null)
  if (!layout) {
    return null
  }
  const { tabs, active, setActive } = layout
  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = tabs.indexOf(active)
    const next =
      event.key === "ArrowRight"
        ? tabs[(at + 1) % tabs.length]
        : event.key === "ArrowLeft"
          ? tabs[(at - 1 + tabs.length) % tabs.length]
          : event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : undefined
    if (next === undefined) {
      return
    }
    event.preventDefault()
    setActive(next)
    list.current?.querySelector<HTMLElement>(`#${tabId(base, next)}`)?.focus()
  }
  return (
    <div
      ref={list}
      role="tablist"
      aria-label={t("storefront.editor.panel.tabs.label")}
      className="sticky top-[var(--editor-panel-head)] z-[6] flex h-11 shrink-0 items-stretch gap-1 border-b bg-card px-3"
    >
      {tabs.map((tab) => {
        const selected = tab === active
        const { label, term } = tabTitle(tab)
        return (
          <button
            key={tab}
            id={tabId(base, tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${base}-tabpanel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              setActive(tab)
            }}
            onKeyDown={move}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1 px-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0",
              selected && "text-foreground after:opacity-100"
            )}
          >
            {t(label)}
            <small className="text-[11px] font-normal text-muted-foreground">{t(term)}</small>
          </button>
        )
      })}
    </div>
  )
}
