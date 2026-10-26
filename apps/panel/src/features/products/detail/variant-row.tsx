import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { levelAt } from "./variant-values"
import type { Variant, VariantValues } from "./variant-values"

interface VariantRowProps {
  variant: Variant
  index: number
  form: UseFormReturn<VariantValues>
  locationId: string | null
  /** The preorder column shows; `preorderOn` says whether one may be turned on. */
  preorder: boolean
  preorderOn: boolean
}

/** One variant's price, stock, held count and preorder switch. */
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
  const rowErrors = form.formState.errors.rows?.[index]
  const error = rowErrors?.price?.message ?? rowErrors?.stock?.message
  const label = (key: string) => `${variant.title ?? ""} ${t(key)}`
  return (
    <tr className="border-t align-top">
      <td className="py-2 pr-3 pl-5">
        <div className="flex flex-col gap-0.5 pt-1.5">
          <span className="font-medium">{variant.title}</span>
          <span className="font-mono text-xs text-muted-foreground">{variant.sku ?? "—"}</span>
          {error ? (
            <span role="alert" className="text-xs text-destructive-text">
              {t(error)}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="relative">
          <Input
            inputMode="decimal"
            aria-label={label("products.wizard.price")}
            className="pr-7 text-right tabular-nums"
            {...form.register(`rows.${index}.price`)}
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">
            ₺
          </span>
        </div>
      </td>
      <td className="px-3 py-2">
        {variant.manage_inventory ? (
          <Input
            inputMode="numeric"
            aria-label={label("products.wizard.stock")}
            disabled={!locationId}
            className="tabular-nums"
            {...form.register(`rows.${index}.stock`)}
          />
        ) : (
          <span className="block pt-2 text-xs text-muted-foreground">
            {t("products.untracked")}
          </span>
        )}
      </td>
      <td className={cn("py-2 pl-3 text-right tabular-nums", preorder ? "pr-3" : "pr-5")}>
        <span className="block pt-2 text-muted-foreground">
          {variant.manage_inventory ? formatCount(level.reserved) : "—"}
        </span>
      </td>
      {preorder ? (
        <td className="py-2 pr-5 pl-3 text-right">
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
                  className="mt-2"
                />
              )}
            />
          ) : (
            <span className="block pt-2 text-muted-foreground">—</span>
          )}
        </td>
      ) : null}
    </tr>
  )
}
