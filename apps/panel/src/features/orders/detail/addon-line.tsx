import { useTranslation } from "react-i18next"
import { lineAddonsOf } from "@/features/orders/addon-lines"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { formatMoney } from "@/lib/format"

/**
 * Under a line with add-ons (adr/0052 §9): each pick with its price per
 * unit, a typed text in full as it is to be made, and whether the line is
 * outside the right of withdrawal.
 */
export function AddonLineDetails({ metadata, currency }: { metadata: unknown; currency: string }) {
  const { t } = useTranslation()
  const addons = lineAddonsOf(metadata)
  if (!addons) {
    return null
  }
  return (
    <div className="mt-1 flex min-w-0 flex-col items-start gap-1">
      <ul className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
        {addons.items.map((item) => (
          <li key={item.id} className="min-w-0 break-words">
            {item.label}:{" "}
            <span className="whitespace-pre-wrap text-foreground">{item.value ?? "—"}</span>
            {item.amount > 0 ? (
              <span className="tabular-nums">
                {" "}
                {t("orders.detail.addonPrice", { amount: formatMoney(item.amount, currency) })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {addons.nonWithdrawable ? <NonWithdrawableBadge /> : null}
    </div>
  )
}
