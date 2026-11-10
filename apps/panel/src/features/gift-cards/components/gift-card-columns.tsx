import { useTranslation } from "react-i18next"
import type { Column } from "@qticaret/admin-ui/patterns/data-table"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { cardBalance, maskCode } from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"
import { GiftCardActions } from "@/features/gift-cards/components/gift-card-actions"
import { formatMoney } from "@qticaret/admin-ui/lib/format"

// Cards do not expire now (adr/0025); one made with a last day before still can
const isExpired = (card: GiftCard) =>
  card.expires_at !== null && new Date(card.expires_at).getTime() < Date.now()

/** The cards' columns: code, value, what is left, the shop's note, state and actions. */
export function useGiftCardColumns(onClose: (card: GiftCard) => void): Column<GiftCard>[] {
  const { t } = useTranslation()
  return [
    {
      key: "code",
      header: t("giftCards.columns.code"),
      cell: (card) => <span className="font-mono text-[13px]">{maskCode(card.code)}</span>,
    },
    {
      key: "value",
      header: t("giftCards.columns.value"),
      align: "right",
      cell: (card) => (
        <span className="tabular-nums">{formatMoney(card.value, card.currency_code)}</span>
      ),
    },
    {
      key: "balance",
      header: t("giftCards.columns.balance"),
      align: "right",
      cell: (card) => (
        <span className="font-medium tabular-nums">
          {formatMoney(cardBalance(card), card.currency_code)}
        </span>
      ),
    },
    {
      key: "note",
      header: t("giftCards.columns.note"),
      className: "hidden lg:table-cell",
      cell: (card) => <span className="text-muted-foreground">{card.note ?? ""}</span>,
    },
    {
      key: "status",
      header: t("giftCards.columns.status"),
      align: "right",
      cell: (card) => {
        const state = isExpired(card) ? "expired" : cardBalance(card) > 0 ? "usable" : "used"
        return (
          <StatusBadge tone={state === "usable" ? "success" : "neutral"}>
            {t(`giftCards.states.${state}`)}
          </StatusBadge>
        )
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("giftCards.columns.actions")}</span>,
      align: "right",
      className: "w-12",
      cell: (card) => <GiftCardActions card={card} onClose={onClose} />,
    },
  ]
}
