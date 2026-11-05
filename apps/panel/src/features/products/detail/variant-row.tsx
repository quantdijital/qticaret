import { Controller, useWatch } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { NumberField } from "@/components/patterns/number-field"
import { Switch } from "@/components/ui/switch"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { levelAt, rowError } from "./variant-values"
import type { Variant, VariantValues } from "./variant-values"

/**
 * The variant's name, first in both views and kept in sight while a
 * narrow table scrolls sideways; under it its stock code (prices view),
 * the row's refused value and a note on what is stored.
 */
export function VariantNameCell({
  variant,
  sku,
  error,
  note,
}: {
  variant: Variant
  /** Shown under the name in the prices view; the codes view has its own field. */
  sku?: string | undefined
  error?: string | undefined
  note?: string | null | undefined
}) {
  const { t } = useTranslation()
  return (
    <td className="sticky left-0 z-10 bg-card py-2 pr-2 pl-5">
      <div className="flex min-w-[7.5rem] flex-col gap-0.5 pt-1.5">
        <span className="line-clamp-2 font-medium" title={variant.title ?? undefined}>
          {variant.title}
        </span>
        {sku !== undefined ? (
          <span className="font-mono text-xs text-muted-foreground">{sku.trim() || "—"}</span>
        ) : null}
        {error ? (
          <span role="alert" className="text-xs text-destructive-text">
            {t(error)}
          </span>
        ) : note ? (
          <span className="text-xs text-warning-text">{t(note)}</span>
        ) : null}
      </div>
    </td>
  )
}

interface VariantRowProps {
  variant: Variant
  index: number
  form: UseFormReturn<VariantValues>
  locationId: string | null
  /** The preorder column shows; `preorderOn` says whether one may be turned on. */
  preorder: boolean
  preorderOn: boolean
}

/** One variant's price, unit cost, stock, held count and preorder switch. */
export function VariantRow({
  variant,
  index,
  form,
  locationId,
  preorder,
  preorderOn,
}: VariantRowProps) {
  const { t } = useTranslation()
  const level = levelAt(variant, locationId)
  const errors = form.formState.errors.rows?.[index]
  const sku = useWatch({ control: form.control, name: `rows.${index}.sku` })
  const label = (key: string) => `${variant.title ?? ""} ${t(key)}`
  return (
    <tr className="border-t align-top">
      <VariantNameCell variant={variant} sku={sku} error={rowError(form, index)} />
      <td className="px-2 py-2">
        <NumberField
          size="compact"
          decimals={2}
          min={0}
          suffix="₺"
          className="w-[11rem] md:w-[10.25rem]"
          aria-label={label("products.wizard.price")}
          aria-invalid={Boolean(errors?.price)}
          {...form.register(`rows.${index}.price`)}
        />
      </td>
      <td className="px-2 py-2">
        <NumberField
          size="compact"
          decimals={2}
          min={0}
          suffix="₺"
          className="w-[11rem] md:w-[10.25rem]"
          aria-label={label("products.detail.cost")}
          aria-invalid={Boolean(errors?.cost)}
          placeholder="—"
          {...form.register(`rows.${index}.cost`)}
        />
      </td>
      <td className="px-2 py-2">
        {variant.manage_inventory ? (
          <NumberField
            size="compact"
            min={0}
            className="w-[8.5rem] md:w-[8rem]"
            aria-label={label("products.wizard.stock")}
            aria-invalid={Boolean(errors?.stock)}
            disabled={!locationId}
            {...form.register(`rows.${index}.stock`)}
          />
        ) : (
          <span className="block w-[8.5rem] pt-2 md:w-[8rem] text-xs text-muted-foreground">
            {t("products.untracked")}
          </span>
        )}
      </td>
      <td className={cn("py-2 pl-2 text-right tabular-nums", preorder ? "pr-2" : "pr-5")}>
        <span className="block pt-1.5 text-muted-foreground">
          {variant.manage_inventory ? formatCount(level.reserved) : "—"}
        </span>
      </td>
      {preorder ? (
        <td className="py-2 pr-5 pl-2 text-right">
          {variant.manage_inventory ? (
            <Controller
              control={form.control}
              name={`rows.${index}.backorder`}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  // Without the flag, one already on can only be turned off
                  disabled={!preorderOn && !variant.allow_backorder}
                  aria-label={label("products.detail.backorder")}
                  className="mt-1.5"
                />
              )}
            />
          ) : (
            <span className="block pt-1.5 text-muted-foreground">—</span>
          )}
        </td>
      ) : null}
    </tr>
  )
}
