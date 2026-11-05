import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { RelatedProductsSection, RelatedSource } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { ColumnsField } from "./columns-field"
import { CountField, F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { RecordField, RecordListField } from "./record-fields"

const P = "storefront.editor.related"

type SourceKind = RelatedSource["kind"]
const SOURCE_KINDS: readonly SourceKind[] = ["same_category", "collection", "manual"]

/** A source of another kind, nothing chosen in it yet. */
function sourceOf(kind: SourceKind): RelatedSource {
  switch (kind) {
    case "same_category":
      return { kind }
    case "collection":
      return { kind, collection_id: "" }
    case "manual":
      return { kind, product_ids: [] }
  }
}

/**
 * Products shown under every product's own: from the product's own
 * category (the storefront finds it per product), a collection, or the
 * same chosen ones on every page.
 */
export function RelatedForm({
  section,
  problems,
  onChange,
}: SectionFormProps<RelatedProductsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<RelatedProductsSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const { source } = section
  const sourceError = problem(problems["source"])
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        value={section.title}
        max={L.title}
        placeholder={t("storefront.editor.defaults.related_products")}
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
              set({ source: sourceOf(kind as SourceKind) })
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
      {source.kind === "same_category" ? (
        <p className="text-xs text-muted-foreground">{t(`${P}.sameCategoryHint`)}</p>
      ) : source.kind === "collection" ? (
        <RecordField
          kind="collection"
          label={t("storefront.editor.products.collection")}
          id={source.collection_id}
          error={sourceError}
          onChange={(id) => {
            set({ source: { kind: "collection", collection_id: id } })
          }}
        />
      ) : (
        <RecordListField
          kind="product"
          label={t("storefront.editor.products.products")}
          ids={source.product_ids}
          max={L.related}
          empty={t("storefront.editor.products.manualEmpty")}
          error={sourceError}
          onChange={(ids) => {
            set({ source: { kind: "manual", product_ids: ids } })
          }}
        />
      )}
      <ColumnsField
        id={`${section.id}-columns`}
        value={section.columns}
        limit={section.limit}
        onChange={(columns) => {
          set({ columns })
        }}
      />
      <CountField
        id={`${section.id}-limit`}
        label={t(`${F}.limit`)}
        hint={t(`${F}.limitHint`, { max: L.related })}
        value={section.limit}
        max={L.related}
        onChange={(limit) => {
          set({ limit }, "limit")
        }}
      />
    </div>
  )
}
