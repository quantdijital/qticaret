import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Gift, Plus } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { GIFT_CARDS_FLAG, giftCardsQuery } from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"
import { NewGiftCardDialog } from "@/features/gift-cards/components/new-gift-card-dialog"
import { PromotionsNav } from "@/features/promotions/components/promotions-nav"
import { featuresQuery } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { formatCount, formatDate, formatMoney } from "@/lib/format"

const isExpired = (card: GiftCard) =>
  card.expires_at !== null && new Date(card.expires_at).getTime() < Date.now()

function useColumns(): Column<GiftCard>[] {
  const { t } = useTranslation()
  return [
    {
      key: "code",
      header: t("giftCards.columns.code"),
      cell: (card) => <span className="font-mono text-[13px]">{card.code}</span>,
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
          {formatMoney(card.store_credit_account?.balance ?? card.value, card.currency_code)}
        </span>
      ),
    },
    {
      key: "expires",
      header: t("giftCards.columns.expires"),
      className: "hidden md:table-cell",
      cell: (card) => (
        <span className="text-muted-foreground tabular-nums">
          {card.expires_at ? formatDate(card.expires_at) : t("giftCards.noEnd")}
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
        const left = card.store_credit_account?.balance ?? card.value
        const state = isExpired(card) ? "expired" : left > 0 ? "usable" : "used"
        return (
          <StatusBadge tone={state === "usable" ? "success" : "neutral"}>
            {t(`giftCards.states.${state}`)}
          </StatusBadge>
        )
      },
    },
  ]
}

/** The shop's cards, newest first, or why they could not be read. */
function GiftCardsList({
  cards,
  add,
}: {
  cards: UseQueryResult<{ cards: GiftCard[]; count: number }>
  add: ReactNode
}) {
  const { t } = useTranslation()
  const columns = useColumns()
  if (cards.isError && !cards.data) {
    return (
      <div className="p-5">
        <ErrorState text={errorText(t, cards.error)} onRetry={() => void cards.refetch()} />
      </div>
    )
  }
  const shown = cards.data?.cards.length ?? 0
  const count = cards.data?.count ?? 0
  return (
    <>
      <DataTable
        columns={columns}
        rows={cards.data?.cards}
        rowKey={(card) => card.id}
        loading={cards.isPending}
        empty={
          <div className="flex flex-col items-center gap-3 text-center">
            <Gift className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("giftCards.empty")}</p>
            {add}
          </div>
        }
      />
      {count > shown ? (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          {t("giftCards.truncated", { shown: formatCount(shown), count: formatCount(count) })}
        </p>
      ) : null}
    </>
  )
}

/** The flag is off: where to turn it on, instead of a list the server would refuse. */
function GiftCardsOff() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <Gift className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">{t("giftCards.off")}</p>
      <Button asChild variant="outline">
        <Link to="/settings/features">{t("giftCards.turnOn")}</Link>
      </Button>
    </div>
  )
}

/**
 * Gift cards (F4.8, ADR-0025): cards the shop gives out, each a code a
 * customer uses at checkout, what each has left. Selling them and their
 * e-mails come with F9.
 */
export function GiftCardsPage() {
  const { t } = useTranslation()
  const features = useQuery(featuresQuery())
  // Unknown when the flags could not be read: the list is tried and says why it failed
  const off =
    features.data !== undefined &&
    !features.data.some((feature) => feature.key === GIFT_CARDS_FLAG && feature.enabled)
  const cards = useQuery({ ...giftCardsQuery(), enabled: features.isFetched && !off })
  const [open, setOpen] = useState(false)
  const add = (
    <Button
      onClick={() => {
        setOpen(true)
      }}
    >
      <Plus />
      {t("giftCards.new")}
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.promotions")}
        description={t("giftCards.description")}
        action={off ? null : add}
      />
      <PromotionsNav />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        {off ? <GiftCardsOff /> : <GiftCardsList cards={cards} add={add} />}
      </section>
      <NewGiftCardDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
