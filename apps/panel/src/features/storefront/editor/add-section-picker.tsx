import { Plus, Search } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { CAPABILITY_GROUPS } from "@qticaret/types"
import type { SectionVariant, VariantSectionType } from "@qticaret/types"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { BodySectionType, PageGroup, Placement } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import {
  PAGE_TYPES,
  allowedTypes,
  chooserGroups,
  newBodySection,
  newPageText,
  typesFor,
} from "@/features/storefront/layout/sections"
import { newFooterSection } from "@/features/storefront/layout/footer-group"
import type { FooterAddType } from "@/features/storefront/layout/footer-group"
import { VariantSketch } from "./forms/variant-sketches"
import { Panel } from "./panel-header"
import { SECTION_ICONS } from "./section-meta"
import { useSectionFlags } from "./section-flags"
import { searchText } from "./settings-search"

/** What the chooser adds: a type, or a content page's own text (`rich_text` as `article`). */
export type AddKind = BodySectionType | "article"

const A = "storefront.editor.add"

interface AddSectionPickerProps {
  /** The page the section is for (a content page's: `pages`), or the footer group (adr/0070 §4). */
  page: PageGroup | "footer"
  /** The footer group's types it does not hold yet: each at most once. */
  footerTypes?: readonly FooterAddType[]
  /** A category page's side of its products. */
  placement: Placement
  /** A content page's own types it holds already (contact, the facts): each stands once. */
  taken?: ReadonlySet<string>
  /** The page already shows its scrolling strips (adr/0049 Ek 2026-11-14 §4.1): no other is offered. */
  marqueeFull: boolean
  /** The page already shows its price bands strips: no other is offered. */
  priceBandsFull?: boolean
  /** Opened from a "+" between two rows: the section lands there, not at the end. */
  aimed?: boolean
  /** Back to the page's parts, nothing added. */
  onBack: () => void
  onPick: (kind: AddKind) => void
}

/** The variant a new section of the kind starts with (null: a type with none). */
function variantOf(page: PageGroup | "footer", kind: AddKind, placement: Placement) {
  const sample =
    kind === "article"
      ? newPageText("ornek")
      : page === "footer"
        ? newFooterSection(kind as FooterAddType, "ornek")
        : newBodySection(page, kind, "ornek", placement)
  return "variant" in sample && typeof sample.variant === "string"
    ? {
        type: sample.type as VariantSectionType,
        variant: sample.variant as SectionVariant<VariantSectionType>,
      }
    : null
}

/**
 * "Bölüm ekle" as a step of the side panel (the owner, 2026-11-27: the
 * Flatsome / Shopify way, no window over the page): the types the page
 * (or the footer group) takes, found by a search, grouped by capability,
 * each a card with its first look drawn small and what it shows in one
 * line (or why it cannot be added). A pick adds it and opens its settings.
 */
export function AddSectionPicker({
  page,
  footerTypes = [],
  placement,
  taken = new Set(),
  marqueeFull,
  priceBandsFull = false,
  aimed = false,
  onBack,
  onPick,
}: AddSectionPickerProps) {
  const { t } = useTranslation()
  const flags = useSectionFlags()
  const [query, setQuery] = useState("")
  const ids = useId()
  // A content page's text first (adr/0073 Ek 2026-11-19 (2) K5); a section whose flag is off
  // not offered, a flagged one under its capability's name (adr/0077 §8)
  const types: readonly AddKind[] =
    page === "footer"
      ? allowedTypes(footerTypes, flags)
      : page === "pages"
        ? ["article", ...allowedTypes(PAGE_TYPES, flags)]
        : typesFor(page, flags)
  // The footer's newsletter box has its own name (adr/0049 Ek 2026-11-17)
  const nameKey = (type: AddKind) =>
    page === "footer" && type === "newsletter" ? "footer_newsletter" : type
  const needle = searchText(query)
  const shown =
    needle === ""
      ? types
      : types.filter((type) => {
          const kind = nameKey(type)
          const words = `${t(`storefront.editor.types.${kind}.name`)} ${t(`storefront.editor.types.${kind}.description`)}`
          return searchText(words).includes(needle)
        })
  const groups = chooserGroups(shown, flags)
  const named = groups.some((group) => group.capability !== null)
  // One type's card: its first look drawn small, what it shows (or why it cannot be added)
  const item = (type: AddKind) => {
    const kind = nameKey(type)
    const Icon = SECTION_ICONS[kind]
    const sketch = variantOf(page, type, placement)
    const full = taken.has(type)
      ? t(`${A}.once`)
      : type === "marquee"
        ? marqueeFull && t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
        : type === "price_bands" &&
          priceBandsFull &&
          t("storefront.editor.priceBands.full", { max: PRICE_BANDS_LIMITS.perPage })
    return (
      <li key={type} className="flex">
        <button
          type="button"
          disabled={Boolean(full)}
          data-add-kind={type}
          className="flex h-[4.75rem] w-full items-center gap-3 rounded-md border bg-card p-2 text-left transition-colors focus-visible:outline-none enabled:hover:border-primary/50 enabled:hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60 [html:not([data-input=pointer])_&:focus-visible]:outline-2 [html:not([data-input=pointer])_&:focus-visible]:outline-ring"
          onClick={() => {
            onPick(type)
          }}
        >
          <span
            aria-hidden="true"
            className="flex h-full w-24 shrink-0 items-center justify-center rounded-sm bg-muted/70 px-1.5 text-muted-foreground"
          >
            {sketch ? (
              <VariantSketch
                type={sketch.type}
                variant={sketch.variant}
                fallback={<Icon className="size-5" />}
              />
            ) : (
              <Icon className="size-5" />
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {t(`storefront.editor.types.${kind}.name`)}
            </span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {full || t(`storefront.editor.types.${kind}.description`)}
            </span>
          </span>
        </button>
      </li>
    )
  }
  const where = aimed ? "aimed" : page === "category" ? placement : page
  return (
    <Panel icon={Plus} title={t(`${A}.title`)} onBack={onBack}>
      <div className="flex flex-col gap-4 px-3 py-4">
        <p className="px-1 text-xs text-muted-foreground">{t(`${A}.description.${where}`)}</p>
        <div role="search" className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            data-level-focus
            aria-label={t(`${A}.search`)}
            placeholder={t(`${A}.searchPlaceholder`)}
            value={query}
            className="pl-8 [&::-webkit-search-cancel-button]:hidden"
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
        </div>
        {shown.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">{t(`${A}.none`)}</p>
        ) : named ? (
          groups.map(({ capability, types: listed }) => {
            const key = capability ?? "general"
            return (
              <section key={key} aria-labelledby={`${ids}-${key}`} className="flex flex-col gap-2">
                <h3 id={`${ids}-${key}`} className="px-1 text-xs font-medium text-muted-foreground">
                  {capability ? t(CAPABILITY_GROUPS[capability].label) : t(`${A}.general`)}
                </h3>
                <ul className="flex flex-col gap-2">{listed.map(item)}</ul>
              </section>
            )
          })
        ) : (
          <ul className="flex flex-col gap-2">{shown.map(item)}</ul>
        )}
      </div>
    </Panel>
  )
}
