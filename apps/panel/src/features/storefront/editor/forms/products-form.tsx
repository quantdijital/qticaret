import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { SHELF_LIMITS } from "@qticaret/types"
import type { ProductSource, ProductsSection, ShelfList } from "@/features/storefront/api/layout"
import { BEST_SELLER_DAYS, LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { FIELD_IDS } from "./field-registry"
import { CountField, F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"
import { LinkField } from "./link-field"
import { ProductSourceField } from "./product-source-field"
import { NAMED, sourceOf } from "./product-sources"
import type { SourceKind } from "./product-sources"

const P = "storefront.editor.products"
const SH = "storefront.editor.shelf"

/** A list's title and source: the rail's own, or one of a columns rail's more. */
interface Listed {
  title: string | null
  source: ProductSource
}

/**
 * One list's title and source; an empty title, or the last source's name,
 * becomes the new source's name when the kind changes.
 */
function ListFields({
  id,
  list,
  titleLabel,
  problems,
  at,
  onChange,
}: {
  id: string
  list: Listed
  titleLabel: string
  problems: SectionFormProps<ProductsSection>["problems"]
  /** The problems' prefix: none for the rail's own, `lists.0.` for its first more. */
  at: string
  onChange: (next: Listed, field?: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const nameOf = (kind: SourceKind) => (NAMED.includes(kind) ? t(`${P}.sources.${kind}`) : null)
  return (
    <>
      <TextField
        id={`${id}-title`}
        label={titleLabel}
        term={t(`${F}.titleTerm`)}
        value={list.title}
        max={L.title}
        placeholder={t("storefront.editor.defaults.products")}
        hint={t(`${F}.titleHint`)}
        error={problem(problems[`${at}title`], L.title)}
        onChange={(title) => {
          onChange({ ...list, title }, `${at}title`)
        }}
      />
      <ProductSourceField
        id={id}
        source={list.source}
        sourceError={problem(problems[`${at}source`])}
        daysError={problem(problems[`${at}days`], BEST_SELLER_DAYS.max)}
        onKind={(kind) => {
          const named = list.title === null || list.title === nameOf(list.source.kind)
          onChange({ source: sourceOf(kind), title: named ? nameOf(kind) : list.title })
        }}
        onChange={(source, field) => {
          onChange({ ...list, source }, field && `${at}${field}`)
        }}
      />
    </>
  )
}

/**
 * A product rail's content (adr/0049 Ek 2026-11-05, Ek 2026-11-15): its
 * title and source, how many it shows (a grid's or a carousel's; the other
 * variants' counts are fixed), a columns rail's one or two more lists, and
 * the "see all" link. How it stands sits in "Diziliş" (`ShelfGroups`).
 */
export function ProductsForm({ section, problems, onChange }: SectionFormProps<ProductsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<ProductsSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const columns = section.variant === "columns"
  const lists = section.lists ?? []
  const setLists = (next: ShelfList[], field?: string) => {
    set({ lists: next }, field)
  }
  return (
    <div className="flex flex-col gap-5">
      <ListFields
        id={section.id}
        list={section}
        titleLabel={t(columns ? `${SH}.firstTitle` : `${F}.title`)}
        problems={problems}
        at=""
        onChange={(next, field) => {
          set(next, field)
        }}
      />
      {section.variant === "grid" || section.variant === "carousel" ? (
        <div id={FIELD_IDS.content(section.id, "limit")}>
          <CountField
            id="products-limit"
            label={t(`${F}.limit`)}
            term={t(`${F}.limitTerm`)}
            hint={t(`${F}.limitHint`, { max: L.items })}
            value={section.limit}
            max={L.items}
            onChange={(limit) => {
              set({ limit }, "limit")
            }}
          />
        </div>
      ) : null}
      {columns
        ? lists.map((list, index) => (
            <fieldset key={index} className="flex flex-col gap-5 border-t pt-4">
              <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium">
                {t(`${SH}.list`, { n: index + 2 })}
                {lists.length > SHELF_LIMITS.columns.lists.min ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setLists(lists.filter((_, at) => at !== index))
                    }}
                  >
                    <Trash2 />
                    {t(`${SH}.removeList`)}
                  </Button>
                ) : null}
              </legend>
              <ListFields
                id={PREVIEW_IDS.text(section.id, `lists.${String(index)}`)}
                list={list}
                titleLabel={t(`${F}.title`)}
                problems={problems}
                at={`lists.${String(index)}.`}
                onChange={(next, field) => {
                  setLists(
                    lists.map((each, at) => (at === index ? next : each)),
                    field
                  )
                }}
              />
            </fieldset>
          ))
        : null}
      {columns && lists.length < SHELF_LIMITS.columns.lists.max ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setLists([...lists, { title: null, source: { kind: "newest" } }])
          }}
        >
          <Plus />
          {t(`${SH}.addList`)}
        </Button>
      ) : null}
      <LinkField
        id="products-more"
        label={t(`${P}.more`)}
        term={t(`${P}.moreTerm`)}
        hint={t(`${P}.moreHint`)}
        link={section.more}
        error={problem(problems["more"], L.label)}
        onChange={(more, field) => {
          set({ more }, field && "more.label")
        }}
      />
    </div>
  )
}
