import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { useRevealTarget } from "@/components/patterns/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { VARIANT_CODES_TARGET } from "./sections"
import { variantFacts } from "./variant-facts"
import { CodeFields, PriceFields, StockFields } from "./variant-fields"
import { useSaveVariant } from "./variant-save"
import { useVariantContext } from "./use-variant-context"
import { savedVariant, variantSchemaFor } from "./variant-values"
import type { VariantField, VariantValues } from "./variant-values"

const ID = "single"

/**
 * A product of one variant: its price, stock and codes right in the card,
 * saved together. There is no other variant to walk to and its pictures
 * are the product's own, so a dialog would only add a click before the
 * most frequent edit; its parcel is the product's "Paket ölçüleri".
 */
export function SingleVariantCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const { variants, locationId, catalog, displays, preorder, preorderOn } =
    useVariantContext(product)
  const variant = variants[0]
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
  // The advisor's "Alana git": the caret in the price or the barcode, the page scrolls to it
  useRevealTarget("product-variants", () => {
    document.getElementById(`${ID}-price`)?.focus({ preventScroll: true })
  })
  useRevealTarget(VARIANT_CODES_TARGET, () => {
    document.getElementById(VARIANT_CODES_TARGET)?.focus({ preventScroll: true })
  })
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
  const submit = form.handleSubmit((values) => {
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
  return (
    <CardForm
      title={t("products.variant.singleTitle")}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      {/* Side by side from `lg` up: the card runs the main column's width */}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
        <PriceFields form={form} idPrefix={ID} sale={facts.sale} others={0} />
        <StockFields
          form={form}
          idPrefix={ID}
          variant={variant}
          locationId={locationId}
          preorder={preorder}
          preorderOn={preorderOn}
        />
      </div>
      <div className="border-t pt-5">
        <CodeFields form={form} idPrefix={ID} saved={saved} />
      </div>
    </CardForm>
  )
}
