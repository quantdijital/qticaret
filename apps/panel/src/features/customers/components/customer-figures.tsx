import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { CustomerStats } from "@/features/customers/api/customers"
import { figureText } from "@/features/customers/figures"
import type { CustomerFigure } from "@/features/customers/figures"

const S = "customers.stats"

/**
 * A customer's numbers side by side (CU1, O4): label over a tabular value,
 * as many columns as the figures, wrapping to two on a narrow card.
 */
export function CustomerFigures({
  stats,
  currency,
  figures,
  className,
}: {
  stats: CustomerStats
  currency: string
  figures: readonly CustomerFigure[]
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <dl
      className={cn("grid grid-cols-2 gap-x-4 gap-y-3", className)}
      data-testid="customer-figures"
    >
      {figures.map((figure, index) => (
        <div
          key={figure}
          className={cn(
            "flex min-w-0 flex-col gap-0.5",
            // An odd one out takes the row on two columns: no hole beside it
            figures.length % 2 === 1 && index === figures.length - 1 && "col-span-2 sm:col-span-1"
          )}
        >
          <dt className="text-xs font-medium text-muted-foreground">{t(`${S}.${figure}`)}</dt>
          <dd className="truncate text-sm font-semibold tabular-nums">
            {figureText(stats, figure, currency)}
          </dd>
        </div>
      ))}
    </dl>
  )
}
