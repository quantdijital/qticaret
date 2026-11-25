import { zodResolver } from "@hookform/resolvers/zod"
import { PanelRightOpen } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { VARIANT_CODES_TARGET } from "./sections"
import { VariantDialog } from "./variant-dialog"
import { variantFacts } from "./variant-facts"
import { CodeFields, PriceFields, StockFields } from "./variant-fields"
import { useSaveVariant } from "./variant-save"
import { useVariantContext } from "./use-variant-context"
import { savedVariant, stockFacts, variantSchemaFor } from "./variant-values"
import type { VariantField, VariantValues } from "./variant-values"

const ID = "single"

/**
 * A product of one variant: its price, stock and codes right in the card,
 * saved together. There is no other variant to walk to and its pictures
 * are the product's own, so a dialog would only add a click before the
 * most frequent edit; its parcel is the product's "Paket ölçüleri". The
 * variant's dialog is still there ("Tüm varyant ayrıntıları") for what the
 * card leaves out: its own pictures and measures. Stock not counted says
 * so in place of the count: it is always sold. Prices are checked by the
 * server as from the dialog.
 */
export function SingleVariantCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const context = useVariantContext(product)
  const { variants, locationId, catalog, displays, preorder, preorderOn } = context
  // "Tüm varyant ayrıntıları": its pictures and parcel too, in the variant's dialog
  const [details, setDetails] = useState(false)
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
    <>
      <CardForm
        title={t("products.variant.singleTitle")}
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!context.ready || form.formState.isDirty}
            title={form.formState.isDirty ? t("products.variant.detailsDirty") : undefined}
            onClick={() => {
              setDetails(true)
            }}
          >
            <PanelRightOpen />
            {t("products.variant.details")}
          </Button>
        }
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
            stock={stockFacts(variant, locationId)}
            locationId={locationId}
            preorder={preorder}
            preorderOn={preorderOn}
          />
        </div>
        <div className="border-t pt-5">
          <CodeFields form={form} idPrefix={ID} saved={saved} />
        </div>
      </CardForm>
      {details && context.ready ? (
        <VariantDialog
          product={product}
          variants={variants}
          index={0}
          onIndexChange={() => undefined}
          onClose={() => {
            setDetails(false)
          }}
          locationId={locationId}
          catalog={catalog}
          displays={displays}
          preorder={preorder}
          preorderOn={preorderOn}
          focus={null}
        />
      ) : null}
    </>
  )
}
