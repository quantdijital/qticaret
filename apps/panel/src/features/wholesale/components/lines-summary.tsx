import { queryOptions, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { LinesPage } from "@/features/wholesale/api/types"
import { sdk } from "@/lib/sdk"
import { formatCount } from "@qticaret/admin-ui/lib/format"
import { WarningNote } from "./warning-note"

const P = "wholesale.prices"

/** The names of the variants the rate gives 0,00 (at most 20 named by the server). */
const variantNamesQuery = (ids: readonly string[]) =>
  queryOptions({
    queryKey: ["wholesale", "variant-names", [...ids].sort()],
    queryFn: async (): Promise<PickerOption[]> =>
      (
        await sdk.admin.productVariant.list({
          id: [...ids],
          limit: ids.length,
          fields: "id,title,sku,product.title",
        })
      ).variants.map((variant) => ({
        id: variant.id,
        label: [variant.product?.title, variant.title, variant.sku].filter(Boolean).join(" · "),
      })),
    enabled: ids.length > 0,
  })

/** The variants the rate would sell at nothing, each with a way to price it by hand. */
function RateZero({
  zero,
  onPrice,
}: {
  zero: LinesPage["rate_zero"]
  onPrice: (variant: PickerOption) => void
}) {
  const { t } = useTranslation()
  const names = useQuery(variantNamesQuery(zero.variant_ids))
  return (
    <WarningNote>
      <p>{t(`${P}.rateZero`, { count: zero.count, formatted: formatCount(zero.count) })}</p>
      {names.data && names.data.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {names.data.map((variant) => (
            <li key={variant.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{variant.label}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onPrice(variant)
                }}
              >
                {t(`${P}.priceIt`)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </WarningNote>
  )
}

/**
 * What the list's numbers say before its rows: prices being written
 * again (one quiet line), retail below wholesale, and variants the rate
 * gives 0,00. Warnings only: nothing here stops a sale or a save.
 */
export function LinesSummary({
  page,
  syncing,
  onPrice,
}: {
  page: LinesPage
  syncing: boolean
  onPrice: (variant: PickerOption) => void
}) {
  const { t } = useTranslation()
  if (!syncing && page.undercut_count === 0 && page.rate_zero.count === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-2 border-t px-5 py-3">
      {syncing ? <p className="text-[13px] text-muted-foreground">{t(`${P}.syncing`)}</p> : null}
      {page.undercut_count > 0 ? (
        <WarningNote>
          {t(`${P}.undercutCount`, {
            count: page.undercut_count,
            formatted: formatCount(page.undercut_count),
          })}
        </WarningNote>
      ) : null}
      {page.rate_zero.count > 0 ? <RateZero zero={page.rate_zero} onPrice={onPrice} /> : null}
    </div>
  )
}
