import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { useVariantContext } from "./use-variant-context"
import { useVariantSale } from "./use-variant-sale"
import { variantFacts } from "./variant-facts"
import { useSaveVariant } from "./variant-save"
import { savedVariant, stockFacts, variantSchemaFor } from "./variant-values"
import type { VariantField, VariantValues } from "./variant-values"

/**
 * A simple product's one variant as the "Ürün verileri" card edits it
 * (docs/06 "Ürün sayfası"): one form behind its Genel tab (price, cost)
 * and its Stok tab (stock, codes), saved together, once on the page's
 * header save. Prices are checked by the server as from the variant's dialog.
 */
export function useSimpleVariant(product: ProductDetail, on: boolean) {
  const { t } = useTranslation()
  const context = useVariantContext(product)
  const { variants, locationId, catalog, displays } = context
  const variant = on ? variants[0] : undefined
  const saved = variant
    ? savedVariant(product, variant, locationId, catalog.get(variant.id), false)
    : null
  const form = useForm<VariantValues>({
    ...(saved
      ? {
          resolver: zodResolver(variantSchemaFor(saved)),
          values: saved,
          resetOptions: { keepDirtyValues: true },
        }
      : {}),
  })
  const save = useSaveVariant(product, locationId)
  // Its sale price (adr/0086), in the Genel tab: saved with the variant, one entry on the page's header save
  const sale = useVariantSale(
    variant ? { productId: product.id, variantId: variant.id } : null,
    false
  )
  const submitForm = form.handleSubmit((values) => {
    if (!variant || !saved) {
      return
    }
    const dirty = form.formState.dirtyFields as Partial<Record<VariantField, boolean>>
    save.mutate(
      { variant, values, saved, dirty },
      {
        onSuccess: () => {
          form.reset(values, FULL_RESET)
          toast.success(t("products.variant.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const reset = () => {
    if (saved) {
      form.reset(saved, FULL_RESET)
    }
    sale.reset()
  }
  const formDirty = form.formState.isDirty
  const dirty = formDirty || sale.dirty
  const saving = save.isPending || sale.saving
  const submit = () => {
    if (formDirty) {
      void submitForm()
    }
    sale.submit()
  }
  // One entry for both tabs: the page's header save saves the variant once
  useDirtyEntry({ dirty, saving, submit, reset })
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
  return {
    form,
    saved,
    sale: facts.sale,
    salePrice: sale,
    stock: stockFacts(variant, locationId),
    context,
    dirty,
    saving,
    submit,
    reset,
  }
}

export type SimpleVariant = NonNullable<ReturnType<typeof useSimpleVariant>>
