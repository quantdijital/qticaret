import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { useSaveVariants } from "@/features/products/api/product-edit"
import type { VariantEdit } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import { BULK_FIELDS, bulkEdit, bulkValue, filtered, filterKey } from "./variant-bulk"
import type { BulkField } from "./variant-bulk"
import type { OptionDraft } from "./variant-options"
import type { Variant } from "./variant-values"

const D = "products.variant.bulk"
const ALL = "all"

/**
 * One change for many variants (the owner, 2026-11-25: "Tümüne fiyat
 * uygula / stok uygula"): a price, a unit cost or a stock count goes to
 * the picked variants, or with none picked to all of them, narrowed by an
 * option's value ("Renk: Kırmızı"). Saved at once through the same variant
 * batch as a single edit; the server checks each price.
 */
export function VariantBulkBar({
  product,
  variants,
  options,
  locationId,
  selected,
  onDone,
}: {
  product: ProductDetail
  variants: readonly Variant[]
  /** The options and values to narrow by. */
  options: readonly OptionDraft[]
  locationId: string | null
  /** Variants picked in the list; none means the filter's. */
  selected: ReadonlySet<string>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [field, setField] = useState<BulkField>("price")
  const [filter, setFilter] = useState("")
  const [text, setText] = useState("")
  const save = useSaveVariants(product.id)
  const targets =
    selected.size > 0
      ? variants.filter((variant) => selected.has(variant.id))
      : filtered(product, variants, filter)
  const value = bulkValue(field, text)
  const apply = () => {
    if (value === null) {
      return
    }
    const edits = targets
      .map((variant) => bulkEdit(variant, field, value, locationId))
      .filter((edit): edit is VariantEdit => edit !== null)
    const skipped = targets.length - edits.length
    if (edits.length === 0) {
      toast.info(t(`${D}.nothing`))
      return
    }
    save.mutate(
      { edits, locationId },
      {
        onSuccess: () => {
          toast.success(
            t(`${D}.applied`, { count: edits.length }) +
              (field === "stock" && skipped > 0
                ? ` ${t(`${D}.untracked`, { count: skipped })}`
                : "")
          )
          setText("")
          onDone()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const label =
    selected.size > 0
      ? t(`${D}.applySelected`, { count: targets.length })
      : t(`${D}.applyAll`, { count: targets.length })
  return (
    <div
      data-variant-bulk=""
      className="flex flex-wrap items-end gap-2 border-t bg-muted/30 px-5 py-3"
      role="group"
      aria-label={t(`${D}.title`)}
    >
      <Select
        value={field}
        onValueChange={(next) => {
          setField(next as BulkField)
          setText("")
        }}
      >
        <SelectTrigger className="w-full sm:w-36" aria-label={t(`${D}.field`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BULK_FIELDS.map((each) => (
            <SelectItem key={each} value={each}>
              {t(`${D}.fields.${each}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <NumberField
        className="w-full sm:w-36"
        aria-label={t(`${D}.value`)}
        aria-invalid={text.trim() !== "" && value === null}
        decimals={field === "stock" ? 0 : 2}
        min={0}
        {...(field === "stock" ? {} : { suffix: "₺" })}
        placeholder={t(`${D}.fields.${field}`)}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            apply()
          }
        }}
      />
      {selected.size === 0 && options.length > 0 ? (
        <Select
          value={filter === "" ? ALL : filter}
          onValueChange={(next) => {
            setFilter(next === ALL ? "" : next)
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label={t(`${D}.filter`)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t(`${D}.every`)}</SelectItem>
            {options.flatMap((option) =>
              option.values.map((each) => (
                <SelectItem
                  key={filterKey(option.title, each)}
                  value={filterKey(option.title, each)}
                >
                  {`${option.title}: ${each}`}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="h-9 w-full sm:w-auto"
        disabled={value === null || targets.length === 0 || save.isPending}
        onClick={apply}
      >
        {save.isPending ? <Loader2 className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  )
}
