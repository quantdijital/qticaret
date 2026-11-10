import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@qticaret/admin-ui/ui/alert"
import type { StockShortLine } from "@/features/orders/stock-short"

/**
 * A paid order placed though the shelf lacked units (adr/0026 Ek
 * 2026-11-06): which lines and how many, and what the shop can do. The
 * order ships once the units are in; shipping holds them itself.
 */
export function StockShortAlert({ lines }: { lines: StockShortLine[] }) {
  const { t } = useTranslation()
  if (lines.length === 0) {
    return null
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("orders.stockShort.title")}</AlertTitle>
      <AlertDescription>
        <p>{t("orders.stockShort.description")}</p>
        <ul className="list-disc ps-5">
          {lines.map((line) => (
            <li key={line.title}>
              {t("orders.stockShort.line", {
                title: line.title,
                short: line.short,
                quantity: line.quantity,
              })}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
