import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import { Link, getRouteApi } from "@tanstack/react-router"
import { Gift, Plus } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  GIFT_CARDS_FLAG,
  giftCardQuery,
  giftCardsQuery,
} from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"
import { CloseGiftCardDialog } from "@/features/gift-cards/components/close-gift-card-dialog"
import { useGiftCardColumns } from "@/features/gift-cards/components/gift-card-columns"
import { NewGiftCardDialog } from "@/features/gift-cards/components/new-gift-card-dialog"
import { PromotionsNav } from "@/features/promotions/components/promotions-nav"
import { featuresQuery } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const route = getRouteApi("/_auth/promotions/gift-cards")

type CardList = UseQueryResult<{ cards: GiftCard[]; count: number }>

/** The shop's cards, newest first, or why they could not be read. */
function GiftCardsList({
  cards,
  add,
  onClose,
}: {
  cards: CardList
  add: ReactNode
  onClose: (card: GiftCard) => void
}) {
  const { t } = useTranslation()
  const columns = useGiftCardColumns(onClose)
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
          {t("giftCards.truncated", { shown: formatCount(shown), total: formatCount(count) })}
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

/** One card, opened from an order's gift line, and the way back to all of them. */
function OneCardBar() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3 text-sm">
      <span className="text-muted-foreground">{t("giftCards.oneCard")}</span>
      <Link to="/promotions/gift-cards" search={{}} className="font-medium text-primary-text">
        {t("giftCards.allCards")}
      </Link>
    </div>
  )
}

/**
 * Gift cards (F4.8, ADR-0025): cards the shop gives out or sells, each a
 * code a customer uses at checkout, what each has left; a card can be
 * closed (its balance debited to zero). `?card=` shows one card alone.
 */
export function GiftCardsPage() {
  const { t } = useTranslation()
  const { card: cardId } = route.useSearch()
  const features = useQuery(featuresQuery())
  // Unknown when the flags could not be read: the list is tried and says why it failed
  const off =
    features.data !== undefined &&
    !features.data.some((feature) => feature.key === GIFT_CARDS_FLAG && feature.enabled)
  const ready = features.isFetched && !off
  const all = useQuery({ ...giftCardsQuery(), enabled: ready && !cardId })
  const one = useQuery({
    ...giftCardQuery(cardId ?? ""),
    enabled: ready && Boolean(cardId),
    select: (card) => ({ cards: [card], count: 1 }),
  })
  const cards: CardList = cardId ? one : all
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState<GiftCard | null>(null)
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
        {off ? null : cardId ? <OneCardBar /> : null}
        {off ? <GiftCardsOff /> : <GiftCardsList cards={cards} add={add} onClose={setClosing} />}
      </section>
      <NewGiftCardDialog open={open} onOpenChange={setOpen} />
      <CloseGiftCardDialog
        card={closing}
        onClose={() => {
          setClosing(null)
        }}
      />
    </div>
  )
}
