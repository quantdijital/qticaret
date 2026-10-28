import { Plus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SearchPicker } from "@/components/patterns/search-picker"
import type { PickerOption } from "@/components/patterns/search-picker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { searchVariants, useEditOrder, useOrderEditPreview } from "@/features/orders/api/edit"
import type { OrderEditChange } from "@/features/orders/api/edit"
import type { OrderDetail } from "@/features/orders/api/orders"
import { differenceText } from "@/features/orders/exchange-text"
import { errorText } from "@/lib/errors"

const E = "orders.edit"

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
  const [picked, setPicked] = useState<PickerOption | null>(null)
  const [pickedCount, setPickedCount] = useState(1)
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(`${E}.title`, { number: order.display_id })}</DialogTitle>
          <DialogDescription>{t(`${E}.description`)}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border">
          <div className="flex items-center gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="flex-1">{t(`${E}.line`)}</span>
            <span className="w-16 text-right">{t(`${E}.quantity`)}</span>
            <span className="w-28 text-right">{t(`${E}.price`)}</span>
            <span className="w-8" />
          </div>
          <ul className="flex flex-col divide-y">
            {items.map((item) => {
              const draft = lines[item.id] ?? { quantity: 0, price: "" }
              return (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={
                      draft.quantity === 0
                        ? "flex-1 truncate text-sm text-muted-foreground line-through"
                        : "flex-1 truncate text-sm font-medium"
                    }
                  >
                    {item.title}
                  </span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={t(`${E}.quantityOf`, { name: item.title })}
                    className="h-8 w-16 text-right tabular-nums"
                    value={draft.quantity}
                    onChange={(event) => {
                      set(item.id, { quantity: count(event.target.value) })
                    }}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    aria-label={t(`${E}.priceOf`, { name: item.title })}
                    className="h-8 w-28 text-right tabular-nums"
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
              <li key={line.variant.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 truncate text-sm font-medium">{line.variant.label}</span>
                <span className="w-16 text-right text-sm tabular-nums">{line.quantity}</span>
                <span className="w-28 text-right text-xs text-muted-foreground">
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
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <SearchPicker
              value={picked}
              onChange={setPicked}
              search={searchVariants}
              queryKey={["orders", "edit", "variants"]}
              placeholder={t(`${E}.addPlaceholder`)}
              empty={t(`${E}.addEmpty`)}
            />
          </div>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            aria-label={t(`${E}.addQuantity`)}
            className="h-9 w-16 text-right tabular-nums"
            value={pickedCount}
            onChange={(event) => {
              setPickedCount(Math.max(1, count(event.target.value)))
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!picked || added.some((line) => line.variant.id === picked.id)}
            onClick={() => {
              if (picked) {
                setAdded([...added, { variant: picked, quantity: pickedCount }])
                setPicked(null)
                setPickedCount(1)
              }
            }}
          >
            <Plus />
            {t(`${E}.add`)}
          </Button>
        </div>
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
