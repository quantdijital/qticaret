import { X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSection,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { useEditOrder, useOrderEditPreview } from "@/features/orders/api/edit"
import type { OrderEditChange } from "@/features/orders/api/edit"
import type { OrderDetail } from "@/features/orders/api/orders"
import { differenceText } from "@/features/orders/exchange-text"
import { errorText } from "@/lib/errors"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { EditAddLine } from "./edit-add-line"

const E = "orders.edit"
// A line's name over its fields on a phone (no column under 160 px), beside them from `sm` up
const LINE = "flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-1.5 sm:flex-nowrap"
const NAME = "min-w-0 basis-full truncate text-sm sm:basis-auto sm:flex-1"
// The count and the price columns, the header over them
const COUNT = "w-24"
const PRICE = "w-32"

interface LineDraft {
  quantity: number
  price: string
}

const count = (value: string) => Math.max(0, Math.trunc(Number(value)) || 0)

/**
 * Staff change an order's lines before it is packed (adr/0033): how many
 * of each (0 takes it off), a corrected price, new variants. What it costs
 * is asked of the server first; saving uses that difference and, when the
 * shopper owes, waits for staff to say they collected it.
 */
export function EditOrderDialog({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const preview = useOrderEditPreview(order.id)
  const edit = useEditOrder(order.id)
  const items = order.items.filter((item) => item.quantity > 0)
  const [lines, setLines] = useState<Record<string, LineDraft>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { quantity: item.quantity, price: String(item.unit_price) }])
    )
  )
  const [added, setAdded] = useState<{ variant: PickerOption; quantity: number }[]>([])
  const [shown, setShown] = useState<{ key: string; difference: string } | null>(null)
  const [collected, setCollected] = useState(false)
  // One edit per opening: a retry of the same save is made once
  const [reference] = useState(() => crypto.randomUUID().replace(/-/g, ""))

  const change: OrderEditChange = {
    items: items.flatMap((item) => {
      const draft = lines[item.id]
      if (!draft) {
        return []
      }
      const price = Number(draft.price)
      const repriced = draft.price !== "" && price !== item.unit_price
      return draft.quantity !== item.quantity || repriced
        ? [{ id: item.id, quantity: draft.quantity, ...(repriced ? { unit_price: price } : {}) }]
        : []
    }),
    add: added.map((line) => ({ variant_id: line.variant.id, quantity: line.quantity })),
  }
  const key = JSON.stringify(change)
  const current = shown?.key === key ? shown.difference : null
  const owes = Number(current ?? 0) > 0
  const empty = change.items.length + change.add.length === 0
  const invalid = Object.values(lines).some(
    (draft) => draft.price === "" || !(Number(draft.price) >= 0)
  )
  const set = (id: string, patch: Partial<LineDraft>) => {
    setLines({ ...lines, [id]: { ...(lines[id] ?? { quantity: 0, price: "" }), ...patch } })
  }
  const failed = (failure: unknown) => toast.error(errorText(t, failure))

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${E}.title`, { number: order.display_id })}</DialogTitle>
          <DialogDescription>{t(`${E}.description`)}</DialogDescription>
        </DialogHeader>
        <DialogBody list>
          <DialogSection title={t(`${E}.linesTitle`)}>
            <div className="rounded-md border">
              {/* A phone names the line over its fields: only the columns are labelled */}
              <div className="flex items-center justify-end gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground sm:justify-start">
                <span className="hidden min-w-0 flex-1 truncate sm:block">{t(`${E}.line`)}</span>
                <span className={cn(COUNT, "text-center")}>{t(`${E}.quantity`)}</span>
                <span className={cn(PRICE, "text-center")}>{t(`${E}.price`)}</span>
                <span className="w-8" />
              </div>
              <ul className="flex flex-col divide-y">
                {items.map((item) => {
                  const draft = lines[item.id] ?? { quantity: 0, price: "" }
                  return (
                    <li key={item.id} className={LINE}>
                      <span
                        className={cn(
                          NAME,
                          draft.quantity === 0
                            ? "text-muted-foreground line-through"
                            : "font-medium"
                        )}
                      >
                        {item.title}
                      </span>
                      <NumberField
                        plain
                        size="compact"
                        min={0}
                        aria-label={t(`${E}.quantityOf`, { name: item.title })}
                        className={cn(COUNT, "ml-auto sm:ml-0")}
                        value={draft.quantity}
                        onChange={(event) => {
                          set(item.id, { quantity: count(event.target.value) })
                        }}
                      />
                      <NumberField
                        plain
                        size="compact"
                        decimals={2}
                        min={0}
                        aria-label={t(`${E}.priceOf`, { name: item.title })}
                        className={PRICE}
                        value={draft.price}
                        onChange={(event) => {
                          set(item.id, { price: event.target.value })
                        }}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t(`${E}.remove`, { name: item.title })}
                        onClick={() => {
                          set(item.id, { quantity: 0 })
                        }}
                      >
                        <X />
                      </Button>
                    </li>
                  )
                })}
                {added.map((line, index) => (
                  <li key={line.variant.id} className={LINE}>
                    <span className={cn(NAME, "font-medium")}>{line.variant.label}</span>
                    <span
                      className={cn(COUNT, "ml-auto pr-2 text-right text-sm tabular-nums sm:ml-0")}
                    >
                      {line.quantity}
                    </span>
                    <span className={cn(PRICE, "text-right text-xs text-muted-foreground")}>
                      {t(`${E}.shopPrice`)}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={t(`${E}.remove`, { name: line.variant.label })}
                      onClick={() => {
                        setAdded(added.filter((_, at) => at !== index))
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </DialogSection>
          <EditAddLine
            taken={new Set(added.map((line) => line.variant.id))}
            onAdd={(variant, quantity) => {
              setAdded([...added, { variant, quantity }])
            }}
          />
          {current !== null ? (
            <p className="text-sm font-medium">{differenceText(t, current)}</p>
          ) : null}
          {owes ? (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={collected}
                onCheckedChange={(on) => {
                  setCollected(on === true)
                }}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{t("orders.returns.exchange.collected")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("orders.returns.exchange.collectedHint")}
                </span>
              </span>
            </label>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {current === null ? (
            <Button
              disabled={empty || invalid || preview.isPending}
              onClick={() => {
                preview.mutate(change, {
                  onSuccess: (difference) => {
                    setShown({ key, difference })
                    setCollected(false)
                  },
                  onError: failed,
                })
              }}
            >
              {t(`${E}.preview`)}
            </Button>
          ) : (
            <Button
              disabled={edit.isPending || (owes && !collected)}
              onClick={() => {
                edit.mutate(
                  {
                    ...change,
                    expected_difference: Number(current),
                    difference_collected: collected,
                    reference,
                  },
                  {
                    onSuccess: (answer) => {
                      if (answer.refund_error) {
                        toast.warning(answer.refund_error)
                      } else {
                        toast.success(t(`${E}.done`))
                      }
                      onClose()
                    },
                    onError: (failure) => {
                      // A difference that moved: the preview is asked again
                      setShown(null)
                      failed(failure)
                    },
                  }
                )
              }}
            >
              {t("common.save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
