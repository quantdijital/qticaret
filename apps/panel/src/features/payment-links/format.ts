import { formatMoney } from "@qticaret/admin-ui/lib/format"

/** A backend amount in kuruş as money: shown, never worked out here. */
export const formatKurus = (amount: number, currencyCode = "try"): string =>
  formatMoney(amount / 100, currencyCode)
