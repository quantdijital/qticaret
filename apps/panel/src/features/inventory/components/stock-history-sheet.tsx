import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { NumberField } from "@/components/patterns/number-field"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  MOVEMENTS_PAGE,
  movementsQuery,
  useSaveWatch,
  watchQuery,
} from "@/features/inventory/api/ledger"
import type { MovementReason, StockMovement } from "@/features/inventory/api/ledger"
import type { StockItem } from "@/features/inventory/api/stock"
import { isThreshold } from "@/features/inventory/drafts"
import { errorText } from "@/lib/errors"
import { formatCount, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const TONES: Record<MovementReason, StatusTone> = {
  manual: "neutral",
  import: "info",
  bulk_edit: "info",
  order: "info",
  return: "success",
  cancel: "neutral",
  reconcile: "warning",
  unknown: "neutral",
}

const signed = (value: number) => (value > 0 ? `+${formatCount(value)}` : formatCount(value))

function Delta({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        value > 0
          ? "text-success-text"
          : value < 0
            ? "text-destructive-text"
            : "text-muted-foreground"
      )}
    >
      {value === 0 ? "—" : signed(value)}
    </span>
  )
}

function MovementRow({ movement }: { movement: StockMovement }) {
  const { t } = useTranslation()
  const order = movement.reference?.startsWith("order_") ? movement.reference : null
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge tone={TONES[movement.reason]}>
          {t(`inventory.history.reasons.${movement.reason}`)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">{formatDateTime(movement.created_at)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <span className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">{t("inventory.history.shelf")}</span>
          <Delta value={movement.delta_stocked} />
          <span className="text-xs text-muted-foreground">
            → {formatCount(movement.stocked_after)}
          </span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">{t("inventory.history.held")}</span>
          <Delta value={movement.delta_reserved} />
          <span className="text-xs text-muted-foreground">
            → {formatCount(movement.reserved_after)}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
        {movement.location_name ? <span>{movement.location_name}</span> : null}
        {order ? (
          <Link to="/orders/$id" params={{ id: order }} className="underline underline-offset-2">
            {t("inventory.history.order")}
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/** The item's own threshold: the shop's unless set; empty goes back to the shop's. */
function ThresholdForm({ itemId }: { itemId: string }) {
  const { t } = useTranslation()
  const watch = useQuery(watchQuery(itemId))
  const save = useSaveWatch(itemId)
  const stored = watch.data?.threshold
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? (stored === null || stored === undefined ? "" : String(stored))
  const valid = text === "" || isThreshold(text)
  const submit = () => {
    save.mutate(text === "" ? null : Number(text), {
      onSuccess: () => {
        setDraft(null)
        toast.success(t("inventory.history.thresholdSaved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="own-threshold" className="text-sm font-medium">
        {t("inventory.history.threshold")}
      </label>
      <div className="flex items-center gap-2">
        <NumberField
          min={0}
          max={100_000}
          id="own-threshold"
          className="min-w-0 flex-1"
          placeholder={watch.data ? String(watch.data.fallback) : ""}
          value={text}
          aria-invalid={!valid || undefined}
          onChange={(event) => {
            setDraft(event.target.value.trim())
          }}
        />
        {/* The field's height beside it, the row filled (docs/18 §2) */}
        <Button type="submit" disabled={!valid || draft === null || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("inventory.history.thresholdHint", { fallback: watch.data?.fallback ?? "" })}
      </p>
    </form>
  )
}

function History({ itemId }: { itemId: string }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const list = useQuery(movementsQuery(itemId, page))
  if (list.error) {
    return <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
  }
  if (!list.data) {
    return <LoadingRows />
  }
  if (list.data.movements.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("inventory.history.empty")}</p>
  }
  return (
    <>
      <ul className="flex flex-col divide-y">
        {list.data.movements.map((movement) => (
          <MovementRow key={movement.id} movement={movement} />
        ))}
      </ul>
      {list.data.count > MOVEMENTS_PAGE ? (
        <Pagination
          page={page}
          pageSize={MOVEMENTS_PAGE}
          count={list.data.count}
          onPageChange={setPage}
        />
      ) : null}
    </>
  )
}

/**
 * An item's stock history (F3.8, adr/0020): every change, why it happened
 * (an order, a return, the stock page, the nightly check), shelf and held
 * counts after it; and the item's own low-stock threshold.
 */
export function StockHistorySheet({
  item,
  onOpenChange,
}: {
  item: StockItem | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const name = item?.variant?.product?.title ?? item?.title ?? item?.sku ?? ""
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{t("inventory.history.title")}</SheetTitle>
          <SheetDescription>
            {[name, item?.variant?.title, item?.sku].filter(Boolean).join(" · ")}
          </SheetDescription>
        </SheetHeader>
        {item ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
            <ThresholdForm key={item.id} itemId={item.id} />
            <History key={`history-${item.id}`} itemId={item.id} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
