import { useTranslation } from "react-i18next"
import type { FeaturedProductSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { RecordField } from "./record-fields"

const P = "storefront.editor.featured"

/**
 * One product up close on the home page (adr/0046 Ek 2026-11-05): the
 * shop picks the product and may write a title and a line; its pictures,
 * headline facts, price and spec table come from the product itself.
 */
export function FeaturedForm({
  section,
  problems,
  onChange,
}: SectionFormProps<FeaturedProductSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<FeaturedProductSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  return (
    <div className="flex flex-col gap-5">
      <RecordField
        kind="product"
        label={t(`${P}.product`)}
        id={section.product_id}
        error={problem(problems["product_id"])}
        onChange={(id) => {
          set({ product_id: id }, "product_id")
        }}
      />
      <p className="-mt-3 text-xs text-muted-foreground">{t(`${P}.hint`)}</p>
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        value={section.title}
        max={L.title}
        placeholder={t("storefront.editor.defaults.featured_product")}
        hint={t(`${F}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          set({ title }, "title")
        }}
      />
      <TextField
        id={`${section.id}-text`}
        label={t(`${F}.text`)}
        value={section.text}
        max={L.text}
        tokens
        multiline
        hint={t(`${F}.textHint`)}
        error={problem(problems["text"], L.text)}
        onChange={(text) => {
          set({ text }, "text")
        }}
      />
    </div>
  )
}
