import { useQuery } from "@tanstack/react-query"
import { Percent, Plus, Trash2, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { EmptyState, ErrorState, LoadingRows } from "@/components/patterns/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { priceListLinesQuery, useSetListPrice } from "@/features/price-lists/api/price-lists"
import type { PriceListLine, PriceListOverlap } from "@/features/price-lists/api/price-lists"
import { DiscountDialog } from "@/features/price-lists/components/discount-dialog"
import { percentOff } from "@/features/price-lists/form"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { errorText } from "@/lib/errors"
import { currencySymbol, formatMoney, formatPercent } from "@/lib/format"
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input"

function OverlapNotice({ overlaps }: { overlaps: PriceListOverlap[] }) {
  const { t } = useTranslation()
  return (
    <div className="border-t px-5 py-4">
      <Alert>
        <TriangleAlert />
        <AlertTitle>{t("priceLists.lines.overlapTitle")}</AlertTitle>
        <AlertDescription>
          <p>{t("priceLists.lines.overlapHint")}</p>
          <ul className="mt-1 list-disc pl-4">
            {overlaps.map((overlap) => (
              <li key={overlap.id}>
                {t("priceLists.lines.overlapItem", {
                  title: overlap.title,
                  count: overlap.variant_count,
                })}
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}

/**
 * A list price typed in place, saved when the field is left changed. The
 * server's price fills it again whenever it changes and nobody is typing,
 * and after a refused save.
 */
function PriceField({ line, name, listId }: { line: PriceListLine; name: string; listId: string }) {
  const { t } = useTranslation()
  const save = useSetListPrice(listId)
  const shown = formatMoneyInput(Number(line.price))
  const [text, setText] = useState(shown)
  const [editing, setEditing] = useState(false)
  const [seen, setSeen] = useState(shown)
  if (shown !== seen && !editing) {
    setSeen(shown)
    setText(shown)
  }
  const commit = () => {
    setEditing(false)
    const amount = parseMoneyInput(text)
    if (amount === null || !(amount > 0)) {
      toast.error(t("priceLists.errors.price"))
      setText(shown)
      return
    }
    if (amount === Number(line.price) || save.isPending) {
      return
    }
    save.mutate(
      { line, amount },
      {
        onSuccess: () => toast.success(t("priceLists.lines.saved", { name })),
        onError: (failure) => {
          setText(shown)
          toast.error(errorText(t, failure))
        },
      }
    )
  }
  return (
    <div className="relative w-32">
      <Input
        aria-label={t("priceLists.lines.priceOf", {
          name,
          currency: line.currency_code.toUpperCase(),
        })}
        inputMode="decimal"
        className="pr-8 text-right tabular-nums"
        value={text}
        onFocus={() => {
          setEditing(true)
        }}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
        {currencySymbol(line.currency_code)}
      </span>
    </div>
  )
}

/** One variant: its own price, its list price, how far below it, and a way out of the list. */
function LineRow({ line, listId }: { line: PriceListLine; listId: string }) {
  const { t } = useTranslation()
  const remove = useSetListPrice(listId)
  const off = percentOff(line.base, line.price)
  const name = [line.product_title, line.variant_title].filter(Boolean).join(" · ")
  return (
    <li className="flex items-center gap-4 border-t px-5 py-3">
      <ProductThumb src={line.thumbnail} className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{line.product_title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {[line.variant_title, line.sku].filter(Boolean).join(" · ")}
        </span>
      </div>
      <span className="hidden w-28 text-right text-[13px] text-muted-foreground tabular-nums sm:inline">
        {line.base
          ? t("priceLists.lines.own", { amount: formatMoney(line.base, line.currency_code) })
          : "—"}
      </span>
      <PriceField line={line} name={name} listId={listId} />
      <span className="hidden w-12 text-right text-xs text-muted-foreground tabular-nums md:inline">
        {off === null ? "" : `−${formatPercent(off / 100)}`}
      </span>
      {/* Not disabled while it works: focus stays on it for keyboard users */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("priceLists.lines.remove", { name })}
        aria-disabled={remove.isPending}
        onClick={() => {
          if (!remove.isPending) {
            remove.mutate(
              { remove: line },
              { onError: (failure) => toast.error(errorText(t, failure)) }
            )
          }
        }}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

/**
 * What the list prices (F4.1): each variant beside its own price, typed in
 * place, or a percentage off for products added or for all of them. Other
 * live lists pricing the same variants on the same days are named.
 */
export function PriceLinesCard({ listId }: { listId: string }) {
  const { t } = useTranslation()
  const lines = useQuery(priceListLinesQuery(listId))
  const [dialog, setDialog] = useState<"add" | "all" | null>(null)
  const rows = lines.data?.lines ?? []
  const products = [...new Set(rows.map((line) => line.product_id))]
  const add = (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        setDialog("add")
      }}
    >
      <Plus />
      {t("priceLists.lines.add")}
    </Button>
  )
  return (
    <SectionCard
      title={t("priceLists.lines.title")}
      description={t("priceLists.lines.hint")}
      action={
        <div className="flex gap-2">
          {rows.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDialog("all")
              }}
            >
              <Percent />
              {t("priceLists.lines.discountAll")}
            </Button>
          ) : null}
          {add}
        </div>
      }
      flush
    >
      {lines.data && lines.data.overlaps.length > 0 ? (
        <OverlapNotice overlaps={lines.data.overlaps} />
      ) : null}
      {lines.isError && !lines.data ? (
        <div className="border-t px-5 py-4">
          <ErrorState text={errorText(t, lines.error)} onRetry={() => void lines.refetch()} />
        </div>
      ) : lines.isPending ? (
        <div className="border-t px-5 py-4">
          <LoadingRows />
        </div>
      ) : rows.length === 0 ? (
        <div className="border-t px-5 py-4">
          <EmptyState text={t("priceLists.lines.empty")} action={add} />
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((line) => (
            <LineRow key={line.price_id} line={line} listId={listId} />
          ))}
        </ul>
      )}
      <DiscountDialog
        listId={listId}
        products={dialog === "all" ? products : null}
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null)
          }
        }}
      />
    </SectionCard>
  )
}
