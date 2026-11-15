import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { ratePercent } from "@/features/wholesale/format"
import { AccountBadge } from "./account-badge"

const C = "wholesale.columns"

/** Where the prices come from, in a word: the level, "Özel fiyat", or both. */
export function useSourceText(): (account: WholesaleAccount) => string {
  const { t } = useTranslation()
  return (account) =>
    [account.tier?.name, account.own_prices ? t("wholesale.ownPrices") : null]
      .filter(Boolean)
      .join(" + ") || "—"
}

/** The wholesalers' table: who, the address, the prices, the minimum, the state. */
export function useAccountColumns(): Column<WholesaleAccount>[] {
  const { t } = useTranslation()
  const sourceText = useSourceText()
  return [
    {
      key: "who",
      header: t(`${C}.who`),
      cell: (account) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">
            {account.company_name ?? account.contact_name ?? "—"}
          </span>
          {account.company_name && account.contact_name ? (
            <span className="truncate text-xs text-muted-foreground">{account.contact_name}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "email",
      header: t(`${C}.email`),
      className: "hidden md:table-cell",
      cell: (account) => <span className="text-muted-foreground">{account.email ?? "—"}</span>,
    },
    {
      key: "source",
      header: t(`${C}.source`),
      cell: (account) => sourceText(account),
    },
    {
      key: "rate",
      header: t(`${C}.rate`),
      align: "right",
      className: "hidden lg:table-cell",
      cell: (account) => (
        <span className="tabular-nums">
          {account.percent === null ? "—" : ratePercent(account.percent)}
        </span>
      ),
    },
    {
      key: "minimum",
      header: t(`${C}.minimum`),
      align: "right",
      className: "hidden lg:table-cell",
      cell: (account) => (
        <span className="tabular-nums">
          {account.min_quantity === null
            ? "—"
            : t("wholesale.units", { count: account.min_quantity })}
        </span>
      ),
    },
    {
      key: "status",
      header: t(`${C}.status`),
      cell: (account) => <AccountBadge status={account.status} />,
    },
  ]
}
