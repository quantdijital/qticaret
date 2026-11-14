import { Search, X } from "lucide-react"
import { useId, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { BodyGroup, LayoutDocument } from "@/features/storefront/api/layout"
import type { FieldGroupName } from "./forms/field-registry"
import { SECTION_ICONS, kindOf, sectionLabel } from "./section-meta"
import { searchSettings, searchedSections } from "./settings-search"
import type { SearchHit } from "./settings-search"

const S = "storefront.editor.search"

/** Each panel group's name, shown under a field found in it. */
const GROUP_NAMES: Readonly<Record<FieldGroupName, string>> = {
  variant: "storefront.editor.panel.variant",
  placement: "storefront.editor.panel.placement",
  content: "storefront.editor.panel.content",
  layout: "storefront.editor.shelf.layout",
  scroll: "storefront.editor.shelf.scroll",
  motion: "storefront.editor.panel.motion",
  appearance: "storefront.editor.panel.appearance",
  look: "storefront.editor.look.title",
  visibility: "storefront.editor.panel.visibility",
}

/**
 * A group's name as the section's panel shows it: a strip's look group is
 * its "Diğer ayarlar", and so is a carousel's, where its scroller settings sit.
 */
const groupName = (field: { group: FieldGroupName; key: string }, type: string) =>
  (type === "marquee" || field.key.startsWith("scroller.")) && field.group === "look"
    ? "storefront.editor.marquee.otherTitle"
    : GROUP_NAMES[field.group]

function HitRow({ hit, onPick }: { hit: SearchHit; onPick: (hit: SearchHit) => void }) {
  const { t } = useTranslation()
  const inFooter = hit.group === "footer"
  const Icon = SECTION_ICONS[kindOf(hit.section, inFooter)]
  const { name } = sectionLabel(t, hit.section, inFooter)
  const { field, option } = hit
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onPick(hit)
        }}
        className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm">
            {field ? t(field.label) : name}
            {field?.term ? (
              <>
                {" "}
                <small className="text-[11px] text-muted-foreground">{t(field.term)}</small>
              </>
            ) : null}
            {option ? <span className="text-muted-foreground">: {t(option)}</span> : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {field
              ? `${name} · ${t(groupName(field, hit.section.type))}`
              : t(`storefront.editor.types.${kindOf(hit.section, inFooter)}.name`)}
          </span>
        </span>
      </button>
    </li>
  )
}

/**
 * The settings search at the top of the page's parts (adr/0049 Ek
 * 2026-11-14 §6): while something is typed, what it finds in place of the
 * list (sections by name, variants, fields by their name or technical
 * term, in Turkish or not); a pick opens the section at that field.
 * Clearing it (or Escape) brings the list back.
 */
export function SettingsSearch({
  doc,
  page,
  onPick,
  children,
}: {
  doc: LayoutDocument
  page: BodyGroup
  onPick: (hit: SearchHit) => void
  /** The page's parts, shown while nothing is typed. */
  children: ReactNode
}) {
  const { t } = useTranslation()
  const id = useId()
  const [query, setQuery] = useState("")
  const hits = useMemo(() => {
    const sections = searchedSections(doc, page, (section, group) => {
      const inFooter = group === "footer"
      const { name } = sectionLabel(t, section, inFooter)
      return [name, t(`storefront.editor.types.${kindOf(section, inFooter)}.name`)]
    })
    return searchSettings(query, sections, t)
  }, [doc, page, query, t])
  const searching = query.trim() !== ""
  return (
    <div className="flex flex-col">
      <div role="search" className="border-b px-3 py-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label={t(`${S}.label`)}
            aria-controls={searching ? `${id}-hits` : undefined}
            placeholder={t(`${S}.placeholder`)}
            value={query}
            className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query !== "") {
                event.preventDefault()
                setQuery("")
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
      <p aria-live="polite" className="sr-only">
        {searching ? t(`${S}.count`, { count: hits.length }) : ""}
      </p>
      {searching ? (
        hits.length > 0 ? (
          <ul
            id={`${id}-hits`}
            aria-label={t(`${S}.results`)}
            className="flex flex-col gap-0.5 px-3 py-3"
          >
            {hits.map((hit) => (
              <HitRow key={`${hit.section.id}:${hit.field?.key ?? ""}`} hit={hit} onPick={onPick} />
            ))}
          </ul>
        ) : (
          <p id={`${id}-hits`} className="px-5 py-6 text-sm text-muted-foreground">
            {t(`${S}.empty`, { query: query.trim() })}
          </p>
        )
      ) : (
        children
      )}
    </div>
  )
}
