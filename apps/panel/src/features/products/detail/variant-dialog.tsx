import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { PriceDisplayView } from "@/features/products/api/price-history"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import type { CatalogVariant } from "./variant-codes"
import { VariantDialogView } from "./variant-dialog-view"
import type { VariantFocus } from "./variant-dialog-view"
import { imageTies, variantFacts } from "./variant-facts"
import { useSaveVariant } from "./variant-save"
import { savedVariant, stockFacts, variantSchemaFor } from "./variant-values"
import type { Variant, VariantValues } from "./variant-values"

export type { VariantFocus, VariantTab } from "./variant-dialog-view"

interface VariantDialogProps {
  product: ProductDetail
  /** The product's variants in their order: the arrows walk through them. */
  variants: readonly Variant[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  locationId: string | null
  catalog: ReadonlyMap<string, CatalogVariant>
  displays: ReadonlyMap<string, PriceDisplayView | null>
  preorder: boolean
  preorderOn: boolean
  focus?: VariantFocus | null
}

/**
 * A saved product's variant in its dialog (`VariantDialogView`): it starts
 * from what is stored, and "Kaydet" saves what changed and closes.
 */
export function VariantDialog({
  product,
  variants,
  index,
  onIndexChange,
  onClose,
  locationId,
  catalog,
  displays,
  preorder,
  preorderOn,
  focus,
}: VariantDialogProps) {
  const { t } = useTranslation()
  const variant = variants[index] ?? variants[0]
  const savedFor = (each: Variant) => savedVariant(product, each, locationId, catalog.get(each.id))
  // What the dialog started from, kept while it is open: the product is read again behind it
  // (pictures settling), and only what differs from this is sent
  const [saved, setSaved] = useState<VariantValues | null>(() =>
    variant ? savedFor(variant) : null
  )
  const form = useForm<VariantValues>({
    ...(saved ? { resolver: zodResolver(variantSchemaFor(saved)), defaultValues: saved } : {}),
  })
  const save = useSaveVariant(product, locationId)

  if (!variant || !saved) {
    return null
  }
  const facts = variantFacts(
    product,
    variant,
    locationId,
    catalog.get(variant.id),
    displays.get(variant.id)
  )
  return (
    <VariantDialogView
      form={form}
      saved={saved}
      description={[facts.name, facts.sku].filter(Boolean).join(" · ")}
      index={index}
      total={variants.length}
      onGo={(to) => {
        const next = variants[to]
        if (next) {
          const start = savedFor(next)
          setSaved(start)
          form.reset(start)
          onIndexChange(to)
        }
      }}
      onClose={onClose}
      onValid={(values, dirty) => {
        save.mutate(
          { variant, values, saved, dirty },
          {
            onSuccess: () => {
              toast.success(t("products.variant.saved"))
              onClose()
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
      saving={save.isPending}
      focus={focus}
      sale={facts.sale}
      stock={stockFacts(variant, locationId)}
      locationId={locationId}
      preorder={preorder}
      preorderOn={preorderOn}
      measures={product}
      ties={imageTies(product, variant.id)}
      saleTarget={{ productId: product.id, variantId: variant.id }}
    />
  )
}
