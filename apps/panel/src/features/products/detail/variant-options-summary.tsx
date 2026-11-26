import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { OptionDraft } from "./variant-options"

const D = "products.variant.options"

/** One option's values as quiet chips (WooCommerce's attribute row). */
export function ValueChipList({ values }: { values: readonly string[] }) {
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5">
      {values.map((value) => (
        <li
          key={value}
          className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs leading-5 text-foreground"
        >
          {value}
        </li>
      ))}
    </ul>
  )
}

/**
 * The product's options, closed (the owner 2026-11-26, WooCommerce's
 * attributes): a heading with its one button, then one row per option, its
 * name and its values as chips; none said in a sentence. Its rows follow
 * the width of the closest `@container/variants`.
 */
export function OptionsSummary({
  options,
  title,
  action,
  onEdit,
}: {
  options: readonly OptionDraft[]
  /** The heading; "Seçenekler" unless told. */
  title?: string
  /** The heading's button in place of "Seçenekleri düzenle". */
  action?: ReactNode
  onEdit?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 px-5 py-4" data-variant-options-summary="">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="text-sm font-medium">{title ?? t(`${D}.title`)}</h3>
        {action ??
          (onEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              {options.length > 0 ? t(`${D}.edit`) : t(`${D}.add`)}
            </Button>
          ) : null)}
      </div>
      {options.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-md border">
          {options.map((option) => (
            <li
              key={option.id ?? option.title}
              className="grid gap-1.5 px-3 py-2.5 @lg/variants:grid-cols-[9rem_minmax(0,1fr)] @lg/variants:items-baseline @lg/variants:gap-4"
            >
              <span className="truncate text-[13px] font-medium">{option.title}</span>
              <ValueChipList values={option.values} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t(`${D}.none`)}</p>
      )}
    </div>
  )
}
