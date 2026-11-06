import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DetailDialog } from "@/components/patterns/detail-dialog"
import { Pagination } from "@/components/patterns/pagination"
import { RecordStepper } from "@/components/patterns/record-stepper"
import type { RecordSteps } from "@/components/patterns/record-stepper"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { NumberField } from "@/components/patterns/number-field"
import { useDiscardGuard } from "@/components/patterns/use-discard-guard"
import { Button } from "@/components/ui/button"
import { DialogBody } from "@/components/ui/dialog"
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
function ThresholdForm({
  itemId,
  onDirtyChange,
}: {
  itemId: string
  /** Whether a threshold is typed and not saved: the dialog asks before leaving it. */
  onDirtyChange: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const watch = useQuery(watchQuery(itemId))
  const save = useSaveWatch(itemId)
  const stored = watch.data?.threshold
  const [draft, setDraft] = useState<string | null>(null)
  const storedText = stored === null || stored === undefined ? "" : String(stored)
  const text = draft ?? storedText
  const valid = text === "" || isThreshold(text)
  const dirty = draft !== null && draft !== storedText
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
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
 * counts after it; and the item's own low-stock threshold. The arrows go
 * to the stock list's next item; a threshold typed and not saved is asked
 * about first. `pane`: the movements scroll under a fixed title, a page
 * of them never makes the box jump.
 */
export function StockHistoryDialog({
  item,
  steps,
  onClose,
}: {
  item: StockItem | null
  /** The item's place on the stock list's page. */
  steps: RecordSteps
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [dirty, setDirty] = useState(false)
  const { guard, confirm } = useDiscardGuard(dirty)
  const name = item?.variant?.product?.title ?? item?.title ?? item?.sku ?? ""
  return (
    <>
      <DetailDialog
        open={item !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDirty(false)
            onClose()
          }
        }}
        onCloseRequest={guard}
        pane
        title={t("inventory.history.title")}
        description={[name, item?.variant?.title, item?.sku].filter(Boolean).join(" · ")}
        headerAction={
          <RecordStepper
            {...steps}
            previousLabel={t("inventory.history.previous")}
            nextLabel={t("inventory.history.next")}
            onGo={(to) => {
              guard(() => {
                setDirty(false)
                steps.onGo(to)
              })
            }}
          />
        }
      >
        {item ? (
          <DialogBody key={item.id}>
            <ThresholdForm itemId={item.id} onDirtyChange={setDirty} />
            <History itemId={item.id} />
          </DialogBody>
        ) : null}
      </DetailDialog>
      {confirm}
    </>
  )
}
