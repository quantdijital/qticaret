import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import { Button } from "@qticaret/admin-ui/ui/button"
import { VARIANT_CODES_TARGET } from "./sections"
import type { SimpleVariant } from "./use-simple-variant"
import { CodeFields, PriceFields, StockFields } from "./variant-fields"

// The ids "Alana git" and ⌘K put the caret in ("#single-price")
const ID = "single"

/** A tab's part of the variant's form, its save and undo once something in it changes. */
function PanelForm({
  label,
  simple,
  children,
}: {
  label: string
  simple: SimpleVariant
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <form
      noValidate
      aria-label={label}
      className="flex min-w-0 flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        simple.submit()
      }}
    >
      {children}
      {simple.dirty || simple.saving ? (
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={simple.saving}
            onClick={simple.reset}
          >
            {t("common.reset")}
          </Button>
          <Button type="submit" size="sm" disabled={simple.saving}>
            {simple.saving ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </div>
      ) : null}
    </form>
  )
}

/** Genel: the selling price, the struck-through one and the unit cost. */
export function PricingPanel({ simple }: { simple: SimpleVariant }) {
  const { t } = useTranslation()
  // The advisor's "Alana git" to a missing price: the caret in it (drawn only for a simple product)
  useRevealTarget("product-variants", () => {
    document.getElementById(`${ID}-price`)?.focus({ preventScroll: true })
  })
  return (
    <PanelForm label={t("products.data.tabs.pricing")} simple={simple}>
      <PriceFields
        form={simple.form}
        idPrefix={ID}
        sale={simple.sale}
        others={0}
        saleOf={simple.salePrice}
      />
    </PanelForm>
  )
}

/** Stok: stock tracking and count, selling past it, and the codes. */
export function StockPanel({ simple }: { simple: SimpleVariant }) {
  const { t } = useTranslation()
  const { context } = simple
  // The advisor's "Alana git" to a missing barcode: the caret in it
  useRevealTarget(VARIANT_CODES_TARGET, () => {
    document.getElementById(VARIANT_CODES_TARGET)?.focus({ preventScroll: true })
  })
  return (
    <PanelForm label={t("products.data.tabs.stock")} simple={simple}>
      <StockFields
        form={simple.form}
        idPrefix={ID}
        stock={simple.stock}
        locationId={context.locationId}
        preorder={context.preorder}
        preorderOn={context.preorderOn}
      />
      <div className="border-t pt-5">
        <CodeFields form={simple.form} idPrefix={ID} saved={simple.saved} />
      </div>
    </PanelForm>
  )
}
