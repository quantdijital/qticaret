import { Search, X } from "lucide-react"
import { useContext } from "react"
import type { RefObject } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { tabTitle } from "./panel-groups"
import type { PanelField, PanelHit } from "./panel-search-fields"
import { SettingsLayoutContext } from "./settings-layout-state"

const S = "storefront.editor.panelSearch"

/**
 * The panel's own search box (adr/0065 Ek, sekmeler): over every setting
 * of this panel, whatever tab or group holds it. Enter takes the shop to
 * the first hit, the down arrow into the list, Escape empties it.
 */
export function PanelSearchBox({
  base,
  label,
  placeholder,
  hits,
  onPick,
  listRef,
}: {
  base: string
  /** Its name and the words standing in it while empty (i18n keys): this section's settings, the theme's. */
  label: string
  placeholder: string
  hits: readonly PanelHit[]
  onPick: (field: PanelField) => void
  listRef: RefObject<HTMLUListElement | null>
}) {
  const { t } = useTranslation()
  const layout = useContext(SettingsLayoutContext)
  if (!layout) {
    return null
  }
  const { query, setQuery } = layout
  const searching = query.trim() !== ""
  return (
    <div role="search" className="border-b px-3 py-2.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label={t(label)}
          aria-controls={searching ? `${base}-hits` : undefined}
          placeholder={t(placeholder)}
          value={query}
          className="h-8 pr-8 pl-8 text-sm [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query !== "") {
              event.preventDefault()
              event.stopPropagation()
              setQuery("")
            } else if (event.key === "Enter" && hits[0]) {
              event.preventDefault()
              onPick(hits[0].field)
            } else if (event.key === "ArrowDown" && hits[0]) {
              event.preventDefault()
              listRef.current?.querySelector<HTMLElement>("button")?.focus()
            }
          }}
        />
        {searching ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t(`${S}.clear`)}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => {
              setQuery("")
            }}
          >
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Where a hit sits: "Stil › Görünüm"; a group alone in its tab or named as it: the tab alone. */
function placeOf(field: PanelField, tab: string, tabbed: boolean) {
  const group = field.groupTitle
  if (!tabbed) {
    return group
  }
  return group === "" || group === tab ? tab : `${tab} › ${group}`
}

/**
 * The hits in place of the tabs while something is typed: each field's
 * name with its term small beside it and the choice found, where it sits
 * under it; a pick opens its tab and group and takes the focus to it.
 */
export function PanelSearchHits({
  base,
  hits,
  onPick,
  listRef,
}: {
  base: string
  hits: readonly PanelHit[]
  onPick: (field: PanelField) => void
  listRef: RefObject<HTMLUListElement | null>
}) {
  const { t } = useTranslation()
  const layout = useContext(SettingsLayoutContext)
  const query = layout?.query.trim() ?? ""
  if (!layout || query === "") {
    return null
  }
  const move = (from: HTMLElement, step: 1 | -1) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLElement>("button") ?? [])]
    const at = buttons.indexOf(from) + step
    if (at < 0) {
      listRef.current
        ?.closest('[role="region"]')
        ?.querySelector<HTMLElement>('input[type="search"]')
        ?.focus()
    } else {
      buttons[at]?.focus()
    }
  }
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {t(`${S}.count`, { count: hits.length })}
      </p>
      {hits.length === 0 ? (
        <p id={`${base}-hits`} className="px-5 py-6 text-sm text-muted-foreground">
          {t(`${S}.empty`, { query })}
        </p>
      ) : (
        <ul
          ref={listRef}
          id={`${base}-hits`}
          aria-label={t(`${S}.results`)}
          className="flex flex-col gap-0.5 px-3 py-3"
        >
          {hits.map(({ field, option }, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  onPick(field)
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault()
                    move(event.currentTarget, event.key === "ArrowDown" ? 1 : -1)
                  }
                }}
                className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="text-sm">
                  {field.label}
                  {field.term ? (
                    <>
                      {" "}
                      <small className="text-[11px] text-muted-foreground">{field.term}</small>
                    </>
                  ) : null}
                  {option ? <span className="text-muted-foreground">: {option}</span> : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {placeOf(field, t(tabTitle(layout.tabOf(field.group)).label), layout.tabbed)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
