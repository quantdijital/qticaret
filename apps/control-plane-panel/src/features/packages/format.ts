import type { TFunction } from "i18next"
import type { LimitKey } from "@qticaret/types/control-plane"
import { formatCount, formatMoney } from "@qticaret/admin-ui/lib/format"
import type { Plan } from "./api"

/** A package's price: "1.490,00 ₺ / ay" (kuruş in, lira out). */
export const priceText = (t: TFunction, plan: Pick<Plan, "price" | "period" | "currency_code">) =>
  t("packages.priceEach", {
    amount: formatMoney(plan.price / 100, plan.currency_code),
    period: t(`packages.period.${plan.period}`),
  })

/** A limit's value: "Sınırsız", "5.000" or "20.480 MB". */
export function limitText(t: TFunction, key: LimitKey, value: number | null | undefined): string {
  if (value === undefined) {
    return "—"
  }
  if (value === null) {
    return t("limits.unlimited")
  }
  return key === "storage_mb"
    ? t("limits.megabytes", { value: formatCount(value) })
    : formatCount(value)
}
