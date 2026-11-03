import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
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
import { Textarea } from "@/components/ui/textarea"
import {
  returnLinesQuery,
  useExcludedLines,
  useReceiveReturn,
  useRejectReturn,
} from "@/features/orders/api/returns"
import type { ReturnReason, ReturnRequest } from "@/features/orders/api/returns"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { errorText } from "@/lib/errors"

const R = "orders.returns"

/** Turns a request down, with the note the shopper reads (adr/0032). */
export function RejectReturnDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const reject = useRejectReturn()
  const [note, setNote] = useState("")
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
          <DialogTitle>
            {t(`${R}.rejectTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.rejectDescription`)}</DialogDescription>
        </DialogHeader>
        <Field label={t(`${R}.rejectNote`)} htmlFor="return-reject-note">
          <Textarea
            id="return-reject-note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={reject.isPending || note.trim() === ""}
            onClick={() => {
              reject.mutate(
                { id: request.id, note: note.trim() },
                {
                  onSuccess: () => {
                    toast.success(t(`${R}.rejected`))
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${R}.reject`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Reasons the shop answers for: refunding the shipping is offered ticked
const SHOP_FAULT: readonly ReturnReason[] = ["damaged", "wrong_item", "not_as_described"]

type Counts = Record<string, { sound: number; damaged: number }>

const linesOf = (counts: Counts, key: "sound" | "damaged") =>
  Object.entries(counts)
    .map(([line_item_id, count]) => ({ line_item_id, quantity: count[key] }))
    .filter((line) => line.quantity > 0)

/**
 * What reached the warehouse (adr/0032): of each asked line, how many came
 * back sound (back in stock) and how many damaged (not), fewer when some
 * did not come back; and whether the shipping is refunded too, the
 * staff's call. Received, it is refunded.
 */
export function ReceiveReturnDialog({
  request,
  onClose,
}: {
  request: ReturnRequest
  onClose: () => void
}) {
  const { t } = useTranslation()
  const receive = useReceiveReturn()
  const lines = useQuery(returnLinesQuery(request.order_id))
  const excluded = useExcludedLines(request.order_id)
  const [counts, setCounts] = useState<Counts>(() =>
    Object.fromEntries(
      request.items.map((item) => [item.line_item_id, { sound: item.quantity, damaged: 0 }])
    )
  )
  const [refundShipping, setRefundShipping] = useState(
    request.kind === "return" && SHOP_FAULT.includes(request.reason)
  )
  const byId = new Map((lines.data ?? []).map((line) => [line.id, line]))
  const sound = linesOf(counts, "sound")
  const damaged = linesOf(counts, "damaged")
  // Sound and damaged together never more than asked: the other gives way
  const set = (id: string, asked: number, key: "sound" | "damaged", value: number) => {
    const own = Math.min(Math.max(Math.trunc(value) || 0, 0), asked)
    const other = key === "sound" ? "damaged" : "sound"
    const current = counts[id] ?? { sound: 0, damaged: 0 }
    setCounts({
      ...counts,
      [id]: { ...current, [key]: own, [other]: Math.min(current[other], asked - own) },
    })
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(`${R}.receiveTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.receiveDescription`)}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border">
          <div className="flex items-center gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="flex-1">{t(`${R}.lineColumn`)}</span>
            <span className="w-16 text-right">{t(`${R}.soundColumn`)}</span>
            <span className="w-16 text-right">{t(`${R}.damagedColumn`)}</span>
            <span className="w-10" />
          </div>
          <ul className="flex flex-col divide-y">
            {request.items.map((item) => {
              const line = byId.get(item.line_item_id)
              const count = counts[item.line_item_id] ?? { sound: 0, damaged: 0 }
              const name = line?.title ?? ""
              return (
                <li key={item.line_item_id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{line?.title ?? "—"}</span>
                      {excluded.has(item.line_item_id) ? <NonWithdrawableBadge /> : null}
                    </span>
                    {line?.variant_title ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {line.variant_title}
                      </span>
                    ) : null}
                  </span>
                  {(["sound", "damaged"] as const).map((key) => (
                    <Input
                      key={key}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={item.quantity}
                      aria-label={t(`${R}.${key}Of`, { name })}
                      className="h-8 w-16 text-right tabular-nums"
                      value={count[key]}
                      onChange={(event) => {
                        set(item.line_item_id, item.quantity, key, Number(event.target.value))
                      }}
                    />
                  ))}
                  <span className="w-10 text-sm text-muted-foreground tabular-nums">
                    / {item.quantity}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        {/* A swap gives no money back for the parcel: the new one goes free */}
        {request.kind === "return" ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={refundShipping}
              onCheckedChange={(on) => {
                setRefundShipping(on === true)
              }}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{t(`${R}.refundShipping`)}</span>
              <span className="text-xs text-muted-foreground">{t(`${R}.refundShippingHint`)}</span>
            </span>
          </label>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={receive.isPending || sound.length + damaged.length === 0}
            onClick={() => {
              receive.mutate(
                { id: request.id, items: sound, damaged, refund_shipping: refundShipping },
                {
                  onSuccess: (answer) => {
                    if (answer.refund_error) {
                      toast.warning(answer.refund_error)
                    } else {
                      toast.success(t(`${R}.refunded`))
                    }
                    onClose()
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {t(`${R}.receive`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
