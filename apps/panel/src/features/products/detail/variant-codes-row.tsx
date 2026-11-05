import { useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { VARIANT_CODES_TARGET } from "./sections"
import { storedGtinNote } from "./variant-codes"
import { VariantNameCell } from "./variant-row"
import { rowError } from "./variant-values"
import type { Variant, VariantValues } from "./variant-values"

const field = "h-8 w-full min-w-[9rem] font-mono md:text-[13px]"

/** One variant's stock code (SKU), barcode (GTIN) and manufacturer part number (MPN). */
export function VariantCodesRow({
  variant,
  index,
  form,
  saved,
  target,
}: {
  variant: Variant
  index: number
  form: UseFormReturn<VariantValues>
  /** The row as stored: a stored barcode that is not a GTIN is pointed out, not refused. */
  saved: VariantValues["rows"][number] | undefined
  /** The advisor's jump lands on this row's barcode. */
  target: boolean
}) {
  const { t } = useTranslation()
  const errors = form.formState.errors.rows?.[index]
  const row = useWatch({ control: form.control, name: `rows.${index}` })
  const label = (key: string) => `${variant.title ?? ""} ${t(key)}`
  return (
    <tr className="border-t align-top">
      <VariantNameCell
        variant={variant}
        error={rowError(form, index)}
        note={storedGtinNote(row, saved)}
      />
      <td className="px-2 py-2">
        <Input
          autoComplete="off"
          spellCheck={false}
          placeholder="—"
          className={field}
          aria-label={label("products.detail.codes.sku")}
          aria-invalid={Boolean(errors?.sku)}
          {...form.register(`rows.${index}.sku`)}
        />
      </td>
      <td className="px-2 py-2">
        <Input
          {...(target ? { id: VARIANT_CODES_TARGET } : {})}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="—"
          // The card's title and the table's head stay in sight above it
          className={cn(field, "scroll-mt-48 tabular-nums")}
          aria-label={label("products.detail.codes.gtin")}
          aria-invalid={Boolean(errors?.gtin)}
          {...form.register(`rows.${index}.gtin`)}
        />
      </td>
      <td className="py-2 pr-5 pl-2">
        <Input
          autoComplete="off"
          spellCheck={false}
          placeholder="—"
          className={field}
          aria-label={label("products.detail.codes.mpn")}
          aria-invalid={Boolean(errors?.mpn)}
          {...form.register(`rows.${index}.mpn`)}
        />
      </td>
    </tr>
  )
}
