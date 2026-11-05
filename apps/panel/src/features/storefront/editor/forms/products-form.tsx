import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { ProductSource, ProductsSection } from "@/features/storefront/api/layout"
import { BEST_SELLER_DAYS, LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { ColumnsField } from "./columns-field"
import { CountField, F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { LinkField } from "./link-field"
import { RecordField, RecordListField } from "./record-fields"

const P = "storefront.editor.products"

type SourceKind = ProductSource["kind"]
const SOURCE_KINDS: readonly SourceKind[] = [
  "newest",
  "best_sellers",
  "on_sale",
  "category",
  "collection",
  "manual",
]

// The sources whose name is the rail's title until the shop writes its own
const NAMED: readonly SourceKind[] = ["best_sellers", "on_sale"]

/** A source of another kind, nothing chosen in it yet. */
function sourceOf(kind: SourceKind): ProductSource {
  switch (kind) {
    case "newest":
    case "on_sale":
      return { kind }
    case "best_sellers":
      return { kind, days: BEST_SELLER_DAYS.default }
    case "category":
      return { kind, category_id: "" }
    case "collection":
      return { kind, collection_id: "" }
    case "manual":
      return { kind, product_ids: [] }
  }
}

/**
 * A rail of products: the newest, the best sellers, those on sale, a
 * category's, a collection's or the shop's own picks. The best sellers
 * and those on sale are picked by the server (adr/0049 Ek 2026-11-05).
 */
export function ProductsForm({ section, problems, onChange }: SectionFormProps<ProductsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<ProductsSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const { source } = section
  const sourceError = problem(problems["source"])
  const nameOf = (kind: SourceKind) => (NAMED.includes(kind) ? t(`${P}.sources.${kind}`) : null)
  /** Another source; an empty title, or the last source's name, becomes the new one's name. */
  const switchTo = (kind: SourceKind) => {
    const named = section.title === null || section.title === nameOf(source.kind)
    set({ source: sourceOf(kind), ...(named ? { title: nameOf(kind) } : {}) })
  }
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id="products-title"
        label={t(`${F}.title`)}
        value={section.title}
        max={L.title}
        placeholder={t("storefront.editor.defaults.products")}
        hint={t(`${F}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          set({ title }, "title")
        }}
      />
      <Field label={t(`${P}.source`)}>
        <RadioGroup
          aria-label={t(`${P}.source`)}
          value={source.kind}
          className="gap-2"
          onValueChange={(kind) => {
            if (kind !== source.kind) {
              switchTo(kind as SourceKind)
            }
          }}
        >
          {SOURCE_KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={kind} />
              {t(`${P}.sources.${kind}`)}
            </label>
          ))}
        </RadioGroup>
      </Field>
      {source.kind === "category" ? (
        <RecordField
          kind="category"
          label={t(`${P}.category`)}
          id={source.category_id}
          error={sourceError}
          onChange={(id) => {
            set({ source: { kind: "category", category_id: id } })
          }}
        />
      ) : source.kind === "collection" ? (
        <RecordField
          kind="collection"
          label={t(`${P}.collection`)}
          id={source.collection_id}
          error={sourceError}
          onChange={(id) => {
            set({ source: { kind: "collection", collection_id: id } })
          }}
        />
      ) : source.kind === "best_sellers" ? (
        <CountField
          id="products-days"
          label={t(`${P}.days`)}
          hint={t(`${P}.daysHint`, { min: BEST_SELLER_DAYS.min, max: BEST_SELLER_DAYS.max })}
          value={source.days}
          min={BEST_SELLER_DAYS.min}
          max={BEST_SELLER_DAYS.max}
          error={problem(problems["days"], BEST_SELLER_DAYS.max)}
          onChange={(days) => {
            set({ source: { kind: "best_sellers", days } }, "days")
          }}
        />
      ) : source.kind === "on_sale" ? (
        <p className="-mt-3 text-xs text-muted-foreground">{t(`${P}.onSaleHint`)}</p>
      ) : source.kind === "manual" ? (
        <RecordListField
          kind="product"
          label={t(`${P}.products`)}
          ids={source.product_ids}
          empty={t(`${P}.manualEmpty`)}
          error={sourceError}
          onChange={(ids) => {
            set({ source: { kind: "manual", product_ids: ids } })
          }}
        />
      ) : null}
      <ColumnsField
        id="products-columns"
        value={section.columns}
        limit={section.limit}
        onChange={(columns) => {
          set({ columns })
        }}
      />
      <CountField
        id="products-limit"
        label={t(`${F}.limit`)}
        hint={t(`${F}.limitHint`, { max: L.items })}
        value={section.limit}
        max={L.items}
        onChange={(limit) => {
          set({ limit }, "limit")
        }}
      />
      <LinkField
        id="products-more"
        label={t(`${P}.more`)}
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
