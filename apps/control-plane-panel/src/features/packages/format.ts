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

/** A platform flag's name (adr/0061 Ek C9); its key where none is written yet. */
export const flagName = (t: TFunction, key: string): string =>
  t(`flags.names.${key.replaceAll(".", "_")}`, { defaultValue: key })

/** On or off, as a flag's value reads; a dash for none. */
export const flagText = (t: TFunction, value: boolean | undefined): string =>
  value === undefined ? "—" : t(value ? "flags.on" : "flags.off")
