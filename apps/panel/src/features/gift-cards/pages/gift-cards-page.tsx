import { useQuery } from "@tanstack/react-query"
import type { UseQueryResult } from "@tanstack/react-query"
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router"
import { Gift, Plus } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/components/patterns/data-table"
import { FilterTabs } from "@/components/patterns/filter-tabs"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  GIFT_CARDS_FLAG,
  GIFT_CARD_PAGE,
  giftCardQuery,
  giftCardsQuery,
} from "@/features/gift-cards/api/gift-cards"
import type { GiftCard } from "@/features/gift-cards/api/gift-cards"
import { CloseGiftCardDialog } from "@/features/gift-cards/components/close-gift-card-dialog"
import { useGiftCardColumns } from "@/features/gift-cards/components/gift-card-columns"
import { NewGiftCardDialog } from "@/features/gift-cards/components/new-gift-card-dialog"
import { GIFT_CARD_STATES } from "@/features/gift-cards/search"
import type { GiftCardSearch } from "@/features/gift-cards/search"
import { PromotionsNav } from "@/features/promotions/components/promotions-nav"
import { featuresQuery } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/promotions/gift-cards")

type CardList = UseQueryResult<{ cards: GiftCard[]; count: number; limited?: boolean }>

/** A page of the shop's cards, or why they could not be read. */
function GiftCardsList({
  cards,
  add,
  searched,
  onClose,
}: {
  cards: CardList
  add: ReactNode
  /** A search or a state is chosen: an empty list says nothing matched. */
  searched: boolean
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
  return (
    <DataTable
      columns={columns}
      rows={cards.data?.cards}
      rowKey={(card) => card.id}
      loading={cards.isPending}
      stale={cards.isPlaceholderData}
      empty={
        <div className="flex flex-col items-center gap-3 text-center">
          <Gift className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {searched ? t("giftCards.noMatch") : t("giftCards.empty")}
          </p>
          {searched ? null : add}
        </div>
      }
    />
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
 * closed (its balance debited to zero). The list goes a page at a time,
 * found by a code or its start and by where the cards stand; codes show
 * masked. `?card=` shows one card alone.
 */
export function GiftCardsPage() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const cardId = search.card
  const q = search.q ?? ""
  const state = search.state ?? "all"
  const page = (search.page ?? 1) - 1
  const features = useQuery(featuresQuery())
  // Unknown when the flags could not be read: the list is tried and says why it failed
  const off =
    features.data !== undefined &&
    !features.data.some((feature) => feature.key === GIFT_CARDS_FLAG && feature.enabled)
  const ready = features.isFetched && !off
  const all = useQuery({ ...giftCardsQuery({ q, state, page }), enabled: ready && !cardId })
  const one = useQuery({
    ...giftCardQuery(cardId ?? ""),
    enabled: ready && Boolean(cardId),
    select: (card) => ({ cards: [card], count: 1 }),
  })
  const cards: CardList = cardId ? one : all
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState<GiftCard | null>(null)
  const setSearch = (next: Pick<GiftCardSearch, "q" | "state" | "page">) => {
    void navigate({
      to: "/promotions/gift-cards",
      search: {
        q: (next.q ?? q) || undefined,
        state: "state" in next ? next.state : search.state,
        page: next.page && next.page > 1 ? next.page : undefined,
      },
      replace: true,
    })
  }
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
  const list = off ? null : cardId ? (
    <>
      <OneCardBar />
      <GiftCardsList cards={cards} add={add} searched={false} onClose={setClosing} />
    </>
  ) : (
    <>
      <FilterTabs
        label={t("giftCards.views")}
        value={state}
        onChange={(next) => {
          setSearch({ state: next === "all" ? undefined : next, page: 1 })
        }}
        tabs={[
          { key: "all" as const, label: t("giftCards.tabs.all") },
          ...GIFT_CARD_STATES.map((key) => ({ key, label: t(`giftCards.tabs.${key}`) })),
        ]}
      />
      <div className="flex flex-col gap-2 px-5 py-3">
        <SearchInput
          value={q}
          placeholder={t("giftCards.search")}
          onChange={(text) => {
            setSearch({ q: text, page: 1 })
          }}
        />
        {all.data?.limited ? (
          <p className="text-xs text-muted-foreground">{t("giftCards.limited")}</p>
        ) : null}
      </div>
      <GiftCardsList
        cards={cards}
        add={add}
        searched={Boolean(q) || state !== "all"}
        onClose={setClosing}
      />
      {all.data && all.data.count > 0 ? (
        <Pagination
          page={page}
          pageSize={GIFT_CARD_PAGE}
          count={all.data.count}
          onPageChange={(next) => {
            setSearch({ page: next + 1 })
          }}
        />
      ) : null}
    </>
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
        {off ? <GiftCardsOff /> : list}
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
