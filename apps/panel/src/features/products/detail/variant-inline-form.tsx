import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import { Button } from "@qticaret/admin-ui/ui/button"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import type { ProductDetail } from "@/features/products/api/products"
import { useStoreUnits } from "@/features/products/use-units"
import { errorText } from "@/lib/errors"
import type { CatalogVariant } from "./variant-codes"
import { imageTies } from "./variant-facts"
import { CodeFields, MeasureFields, PriceFields, StockFields } from "./variant-fields"
import { VariantPictures } from "./variant-pictures"
import { useVariantSale } from "./use-variant-sale"
import { useSaveVariant } from "./variant-save"
import { FIELD_TABS, fieldId, savedVariant, stockFacts, variantSchemaFor } from "./variant-values"
import type { Variant, VariantField, VariantValues } from "./variant-values"

/** The form's element ids: the barcode keeps the advisor's target (`fieldId`). */
const ID = "variant"

interface VariantInlineFormProps {
  product: ProductDetail
  variant: Variant
  locationId: string | null
  catalog: CatalogVariant | undefined
  sale: { price: number; struck: number } | null
  preorder: boolean
  preorderOn: boolean
  /** A field to put the caret in once drawn (the advisor's "Alana git"). */
  focus: string | null
  /** Tells the list whether something here is not kept: closing it asks first. */
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
}

/**
 * Everything about one variant, open in its row (the owner, 2026-11-25:
 * "modal olmasın", WooCommerce's variations): price and stock, codes and
 * its own parcel, its pictures, one under another. "Kaydet" here, the
 * page's header save or ⌘S save it; a refused field is told beside it and
 * gets the caret. Prices are checked by the server as everywhere else.
 */
export function VariantInlineForm({
  product,
  variant,
  locationId,
  catalog,
  sale,
  preorder,
  preorderOn,
  focus,
  onDirtyChange,
  onClose,
}: VariantInlineFormProps) {
  const { t } = useTranslation()
  const units = useStoreUnits()
  // What it started from, kept while open: the product is read again behind it
  const [saved, setSaved] = useState<VariantValues>(() =>
    savedVariant(product, variant, locationId, catalog)
  )
  const form = useForm<VariantValues>({
    resolver: zodResolver(variantSchemaFor(saved)),
    defaultValues: saved,
  })
  const save = useSaveVariant(product, locationId)
  // Its sale price (adr/0086): saved with the row's "Kaydet", one entry on the page's header save
  const salePrice = useVariantSale({ productId: product.id, variantId: variant.id }, false)
  const formDirty = form.formState.isDirty
  const dirty = formDirty || salePrice.dirty
  const saving = save.isPending || salePrice.saving
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(
    () => () => {
      onDirtyChange(false)
    },
    [onDirtyChange]
  )
  const [caret, setCaret] = useState<{ id: string } | null>(focus ? { id: focus } : null)
  useLayoutEffect(() => {
    if (caret) {
      const field = document.getElementById(caret.id)
      field?.focus({ preventScroll: true })
      field?.scrollIntoView({ block: "center" })
    }
  }, [caret])

  const showError = (errors: FieldErrors<VariantValues>) => {
    const field = (Object.keys(FIELD_TABS) as VariantField[]).find((name) => errors[name])
    if (field) {
      setCaret({ id: fieldId(field) })
    }
  }
  const submitForm = form.handleSubmit((values) => {
    const changed = form.formState.dirtyFields as Partial<Record<VariantField, boolean>>
    save.mutate(
      { variant, values, saved, dirty: changed },
      {
        onSuccess: () => {
          setSaved(values)
          form.reset(values, FULL_RESET)
          toast.success(t("products.variant.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }, showError)
  const submit = () => {
    if (formDirty) {
      void submitForm()
    }
    salePrice.submit()
  }
  const reset = () => {
    form.reset(saved, FULL_RESET)
    salePrice.reset()
  }
  useDirtyEntry({ dirty, saving, submit, reset })

  return (
    <form
      noValidate
      aria-label={t("products.variant.title")}
      className="flex flex-col gap-6 border-t bg-muted/30 px-5 py-5"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !dirty) {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      {/* Side by side from `lg` up, one under another on a phone or a tablet */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <PriceFields form={form} idPrefix={ID} sale={sale} others={0} saleOf={salePrice} />
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
      <div className="grid gap-6 border-t pt-5 lg:grid-cols-2 lg:gap-8">
        <MeasureFields form={form} idPrefix={ID} fallback={product} units={units} />
        <VariantPictures form={form} ties={imageTies(product, variant.id)} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={dirty ? reset : onClose}
        >
          {dirty ? t("common.reset") : t("common.close")}
        </Button>
        <Button type="submit" size="sm" disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </div>
    </form>
  )
}
