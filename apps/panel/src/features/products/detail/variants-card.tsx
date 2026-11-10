import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import { VARIANT_CODES_TARGET } from "./sections"
import { SingleVariantCard } from "./single-variant-card"
import { firstUncoded, savedCodes } from "./variant-codes"
import { VariantDialog } from "./variant-dialog"
import type { VariantFocus } from "./variant-dialog"
import { variantFacts } from "./variant-facts"
import { VARIANT_COLUMNS, VariantListRow } from "./variant-list-row"
import { priceOf } from "./variant-values"
import { useVariantContext } from "./use-variant-context"

const D = "products.variant"

type Open = { index: number; focus: VariantFocus | null } | null

/**
 * The product's variants (docs/06 "Ürün sayfası"): one row each with its
 * picture, values, price, stock and notes; a row opens the variant's
 * dialog with everything about it. A product of one variant has its
 * price, stock and codes right in the card instead (`SingleVariantCard`).
 */
export function VariantsCard({ product }: { product: ProductDetail }) {
  if ((product.variants?.length ?? 0) <= 1) {
    return <SingleVariantCard product={product} />
  }
  return <VariantList product={product} />
}

function VariantList({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const context = useVariantContext(product)
  const { variants, locationId, catalog, displays } = context
  const [open, setOpen] = useState<Open>(null)
  // The advisor's "Alana git": a missing price opens that variant, a missing barcode its codes
  useRevealTarget("product-variants", () => {
    const index = variants.findIndex((variant) => priceOf(variant) === null)
    if (index >= 0) {
      setOpen({ index, focus: { tab: "prices", field: "variant-price" } })
    }
  })
  useRevealTarget(VARIANT_CODES_TARGET, () => {
    const index = firstUncoded(
      variants.map((variant) => savedCodes(variant, catalog.get(variant.id)))
    )
    setOpen({ index, focus: { tab: "codes", field: VARIANT_CODES_TARGET } })
  })
  return (
    <SectionCard
      title={t(`${D}.listTitle`, { count: variants.length })}
      description={t(`${D}.listHint`)}
      flush
    >
      <div
        aria-hidden="true"
        className={`${VARIANT_COLUMNS} hidden border-y bg-muted/60 px-5 py-2 text-xs font-medium text-muted-foreground sm:grid`}
      >
        <span />
        <span>{t("products.wizard.variant")}</span>
        <span>{t("products.wizard.price")}</span>
        <span>{t("products.wizard.stock")}</span>
        <span />
        <span />
      </div>
      <ul className="flex flex-col divide-y border-t sm:border-t-0 [&>li:last-child>button]:rounded-b-lg">
        {variants.map((variant, index) => (
          <VariantListRow
            key={variant.id}
            facts={variantFacts(
              product,
              variant,
              locationId,
              catalog.get(variant.id),
              displays.get(variant.id)
            )}
            disabled={!context.ready}
            onOpen={() => {
              setOpen({ index, focus: null })
            }}
          />
        ))}
      </ul>
      {open && context.ready ? (
        <VariantDialog
          product={product}
          variants={variants}
          index={open.index}
          onIndexChange={(index) => {
            setOpen({ index, focus: null })
          }}
          onClose={() => {
            setOpen(null)
          }}
          locationId={locationId}
          catalog={catalog}
          displays={displays}
          preorder={context.preorder}
          preorderOn={context.preorderOn}
          focus={open.focus}
        />
      ) : null}
    </SectionCard>
  )
}
