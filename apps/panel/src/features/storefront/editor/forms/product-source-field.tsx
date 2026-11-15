import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { ProductSource } from "@/features/storefront/api/layout"
import { BEST_SELLER_DAYS } from "@/features/storefront/api/layout"
import { CountField } from "./fields"
import { SOURCE_KINDS } from "./product-sources"
import type { SourceKind } from "./product-sources"
import { RecordField, RecordListField } from "./record-fields"

const P = "storefront.editor.products"

/**
 * Where a list takes its products from: the newest, the best sellers,
 * those on sale (both picked by the server, adr/0049 Ek 2026-11-05), a
 * category's, a collection's or the shop's own picks; and what that kind
 * asks for. A product rail's own and each of a columns rail's lists.
 */
export function ProductSourceField({
  id,
  source,
  sourceError,
  daysError,
  onKind,
  onChange,
}: {
  id: string
  source: ProductSource
  sourceError: string | undefined
  daysError: string | undefined
  /** Another kind picked: the form may rename the list. */
  onKind: (kind: SourceKind) => void
  onChange: (source: ProductSource, field?: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Field label={t(`${P}.source`)}>
        <RadioGroup
          aria-label={t(`${P}.source`)}
          value={source.kind}
          className="gap-2"
          onValueChange={(kind) => {
            if (kind !== source.kind) {
              onKind(kind as SourceKind)
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
          onChange={(category_id) => {
            onChange({ kind: "category", category_id })
          }}
        />
      ) : source.kind === "collection" ? (
        <RecordField
          kind="collection"
          label={t(`${P}.collection`)}
          id={source.collection_id}
          error={sourceError}
          onChange={(collection_id) => {
            onChange({ kind: "collection", collection_id })
          }}
        />
      ) : source.kind === "best_sellers" ? (
        <CountField
          id={`${id}-days`}
          label={t(`${P}.days`)}
          hint={t(`${P}.daysHint`, { min: BEST_SELLER_DAYS.min, max: BEST_SELLER_DAYS.max })}
          value={source.days}
          min={BEST_SELLER_DAYS.min}
          max={BEST_SELLER_DAYS.max}
          error={daysError}
          onChange={(days) => {
            onChange({ kind: "best_sellers", days }, "days")
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
          onChange={(product_ids) => {
            onChange({ kind: "manual", product_ids })
          }}
        />
      ) : null}
    </>
  )
}
