import { useEffect, useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { PanelSearchBox, PanelSearchHits } from "./panel-search"
import { collectFields, searchPanel } from "./panel-search-fields"
import type { PanelField, PanelHit } from "./panel-search-fields"
import { tabId } from "./panel-groups"
import type { SettingsTab } from "./panel-groups"
import { SettingsLayoutContext, useSettingsLayout } from "./settings-layout-state"
import { SettingsTabs } from "./settings-tabs"
import { showField, useFieldFocus } from "./use-field-focus"
import type { FieldFocus } from "./use-field-focus"

/**
 * A settings panel's body as tabs, closed groups and its own search
 * (adr/0065 Ek, sekmeler; the owner's "Elementor'deki gibi"): the search
 * box, the tabs (only those holding a group, none with one), then every
 * group of the panel in one tab panel, those of the other tabs hidden.
 * While something is typed the hits stand in place of the tabs. A field
 * picked from outside (`focus`: the settings search, the preview's edit
 * label) opens its tab and group and is focused; so is a hit.
 */
export function SettingsLayout({
  scope,
  resetKey,
  tabOf,
  tabbed = true,
  searchLabel = "storefront.editor.panelSearch.label",
  searchPlaceholder = "storefront.editor.panelSearch.placeholder",
  focus,
  children,
}: {
  /** What the open groups are remembered by: a section's type, the theme. */
  scope: string
  /** What is shown: another starts at its first tab with the search empty. */
  resetKey: string
  tabOf: (name: string) => SettingsTab
  tabbed?: boolean
  /** The search box's name (i18n key). */
  searchLabel?: string
  /** Its words while empty (i18n key), told apart from the editor's search over every section. */
  searchPlaceholder?: string
  focus: (FieldFocus & { group: string }) | null
  children: ReactNode
}) {
  const base = useId().replaceAll(":", "")
  const layout = useSettingsLayout({ scope, resetKey, tabOf, tabbed, focus })
  const body = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [hits, setHits] = useState<readonly PanelHit[]>([])
  const [picked, setPicked] = useState<PanelField | null>(null)
  useFieldFocus(focus)
  useEffect(() => (picked ? showField(picked.element, picked.control) : undefined), [picked])
  const searching = layout.query.trim() !== ""
  const showTabs = tabbed && layout.tabs.length > 1 && !searching
  const value = {
    ...layout,
    // The hits are read from the drawn panel as the shop types
    setQuery: (query: string) => {
      layout.setQuery(query)
      setHits(body.current ? searchPanel(query, collectFields(body.current)) : [])
    },
  }
  const pick = (field: PanelField) => {
    layout.reveal(field.group)
    setPicked({ ...field })
  }
  return (
    <SettingsLayoutContext.Provider value={value}>
      <PanelSearchBox
        base={base}
        label={searchLabel}
        placeholder={searchPlaceholder}
        hits={hits}
        onPick={pick}
        listRef={list}
      />
      {showTabs ? <SettingsTabs base={base} /> : null}
      <PanelSearchHits base={base} hits={hits} onPick={pick} listRef={list} />
      <div
        ref={body}
        hidden={searching}
        className={showTabs ? "[--editor-panel-tabs:2.75rem]" : undefined}
        {...(showTabs
          ? {
              role: "tabpanel",
              id: `${base}-tabpanel`,
              "aria-labelledby": tabId(base, layout.active),
            }
          : {})}
      >
        {children}
      </div>
    </SettingsLayoutContext.Provider>
  )
}
