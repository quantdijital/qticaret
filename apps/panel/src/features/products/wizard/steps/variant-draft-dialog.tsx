import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useForm, useFormContext } from "react-hook-form"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { VariantDialogView } from "@/features/products/detail/variant-dialog-view"
import { variantSchemaFor } from "@/features/products/detail/variant-values"
import type { VariantValues } from "@/features/products/detail/variant-values"
import type { WizardValues } from "../schema"
import { applyDraft, draftMeasures, draftName, draftTies, draftValues } from "../variant-draft"

// Every barcode typed on a new product is checked: none of them is stored yet
const checkAll = (start: VariantValues): VariantValues => ({ ...start, gtin: "" })

/**
 * A new product's variant in the product page's variant dialog: price and
 * cost, stock, codes, its own parcel and its pictures, picked from the
 * ones added in the form (or added from the library). "Kaydet" puts them
 * in the form; the product saves them all at once.
 */
export function VariantDraftDialog({
  index,
  onIndexChange,
  onClose,
}: {
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const wizard = useFormContext<WizardValues>()
  const defaults = useQuery(shopDefaultsQuery())
  const [start, setStart] = useState<VariantValues | null>(() =>
    draftValues(wizard.getValues(), index)
  )
  const form = useForm<VariantValues>({
    ...(start
      ? { resolver: zodResolver(variantSchemaFor(checkAll(start))), defaultValues: start }
      : {}),
  })
  const values = wizard.getValues()
  const row = values.variants[index]
  if (!row || !start) {
    return null
  }
  return (
    <VariantDialogView
      form={form}
      saved={checkAll(start)}
      description={[draftName(row), row.sku.trim()].filter(Boolean).join(" · ")}
      index={index}
      total={values.variants.length}
      onGo={(to) => {
        const next = draftValues(wizard.getValues(), to)
        if (next) {
          setStart(next)
          form.reset(next)
          onIndexChange(to)
        }
      }}
      onClose={onClose}
      onValid={(typed) => {
        const next = applyDraft(wizard.getValues(), index, typed)
        const checked = wizard.formState.isSubmitted
        wizard.setValue("images", next.images, { shouldDirty: true })
        wizard.setValue("variants", next.variants, { shouldDirty: true, shouldValidate: checked })
        onClose()
      }}
      saving={false}
      sale={null}
      stock={{
        tracked: values.manage_inventory,
        reserved: null,
        backorder: values.allow_backorder,
      }}
      locationId={defaults.data?.locationId ?? null}
      // Selling past stock is the product's switch beside the table
      preorder={false}
      preorderOn={false}
      measures={draftMeasures(values)}
      ties={draftTies(values, index)}
      alts={false}
    />
  )
}
