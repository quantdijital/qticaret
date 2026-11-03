import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { NumberField } from "@/components/patterns/number-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { excludedLinesOf, returnLinesQuery, useReceiveReturn } from "@/features/orders/api/returns"
import type { ReturnReason, ReturnRequest } from "@/features/orders/api/returns"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { ReturnFacts, SealedGoodsBadge } from "@/features/orders/components/return-facts"
import { GiftReturnNote } from "@/features/orders/detail/gift-return-dialog"
import {
  EMPTY_COUNT,
  initialCounts,
  linesOf,
  setCount,
  shippingRule,
} from "@/features/orders/receive-rules"
import type { CountKey, Counts } from "@/features/orders/receive-rules"
import { sealedLinesOf } from "@/features/orders/return-facts"
import { giftLineIds } from "@/features/orders/return-rules"
import { errorText } from "@/lib/errors"

const R = "orders.returns"

// Reasons the shop answers for: a faulty excluded line's shipping is offered ticked
const SHOP_FAULT: readonly ReturnReason[] = ["damaged", "wrong_item", "not_as_described"]

/**
 * What reached the warehouse (adr/0032): of each asked line, how many came
 * back sound (back in stock), damaged (not) and, for a sealed good, opened
 * (refused: not refunded, sent back; Ek 2026-11-03, MSY md. 15/1-ç); fewer
 * when some did not come back. The shipping comes back by law with any
 * line inside the right of withdrawal (md. 12/1); only a return of lines
 * outside it leaves that to staff. Received, it is refunded.
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
  const excluded = excludedLinesOf(request)
  const sealed = sealedLinesOf(request)
  const [counts, setCounts] = useState<Counts>(() => initialCounts(request))
  const [staffShipping, setStaffShipping] = useState(SHOP_FAULT.includes(request.reason))
  const byId = new Map((lines.data ?? []).map((line) => [line.id, line]))
  // A gift card withdrawal is received when approved; one shown here is said so all the same
  const gifts = giftLineIds(lines.data)
  const sound = linesOf(counts, "sound")
  const damaged = linesOf(counts, "damaged")
  const refused = linesOf(counts, "refused")
  const rule = shippingRule(request, counts)
  const refundShipping = rule === "law" || (rule === "choice" && staffShipping)
  const keys: readonly CountKey[] =
    sealed.size > 0 ? ["sound", "damaged", "refused"] : ["sound", "damaged"]
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent size={sealed.size > 0 ? "lg" : "md"}>
        <DialogHeader>
          <DialogTitle>
            {t(`${R}.receiveTitle`, { number: request.order_display_id ?? "—" })}
          </DialogTitle>
          <DialogDescription>{t(`${R}.receiveDescription`)}</DialogDescription>
        </DialogHeader>
        <DialogBody list>
          <ReturnFacts request={request} />
          <div className="rounded-md border">
            {/* A phone names the line over its fields: only the columns are labelled */}
            <div className="flex items-center justify-end gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground sm:justify-start">
              <span className="hidden min-w-0 flex-1 truncate sm:block">
                {t(`${R}.lineColumn`)}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {keys.map((key) => (
                  <span key={key} className="w-22 text-center">
                    {t(`${R}.${key}Column`)}
                  </span>
                ))}
                <span className="w-7" />
              </span>
            </div>
            <ul className="flex flex-col divide-y">
              {request.items.map((item) => {
                const line = byId.get(item.line_item_id)
                const count = counts[item.line_item_id] ?? EMPTY_COUNT
                const name = line?.title ?? ""
                return (
                  // A phone puts the counts under the name: no name column squeezed under 160 px
                  <li
                    key={item.line_item_id}
                    className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-1.5 sm:flex-nowrap"
                  >
                    <span className="flex min-w-0 basis-full flex-col gap-1 sm:flex-1 sm:basis-auto">
                      <span className="truncate text-sm font-medium">{line?.title ?? "—"}</span>
                      {line?.variant_title ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {line.variant_title}
                        </span>
                      ) : null}
                      {excluded.has(item.line_item_id) || sealed.has(item.line_item_id) ? (
                        <span className="flex flex-wrap gap-1.5">
                          {excluded.has(item.line_item_id) ? (
                            <NonWithdrawableBadge reason={excluded.get(item.line_item_id)} />
                          ) : null}
                          {sealed.has(item.line_item_id) ? <SealedGoodsBadge /> : null}
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      {keys.map((key) =>
                        // Only a sealed good is refused for being opened (`returns.refusal_not_sealed`)
                        key === "refused" && !sealed.has(item.line_item_id) ? (
                          <span
                            key={key}
                            aria-hidden="true"
                            className="w-22 text-center text-muted-foreground"
                          >
                            —
                          </span>
                        ) : (
                          <NumberField
                            key={key}
                            plain
                            size="compact"
                            min={0}
                            max={item.quantity}
                            aria-label={t(`${R}.${key}Of`, { name })}
                            className="w-22"
                            value={count[key]}
                            onChange={(event) => {
                              setCounts({
                                ...counts,
                                [item.line_item_id]: setCount(
                                  count,
                                  key,
                                  Number(event.target.value),
                                  item.quantity
                                ),
                              })
                            }}
                          />
                        )
                      )}
                      <span className="w-7 text-sm text-muted-foreground tabular-nums">
                        / {item.quantity}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
          {sealed.size > 0 ? (
            <p className="text-xs text-muted-foreground">{t(`${R}.refusedHint`)}</p>
          ) : null}
          {request.items.some((item) => gifts.has(item.line_item_id)) ? <GiftReturnNote /> : null}
          {/* A swap gives no money back for the parcel: the new one goes free */}
          {request.kind === "return" ? (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={refundShipping}
                disabled={rule !== "choice"}
                onCheckedChange={(on) => {
                  setStaffShipping(on === true)
                }}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{t(`${R}.refundShipping`)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`${R}.refundShippingHints.${rule}`)}
                </span>
              </span>
            </label>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={receive.isPending || sound.length + damaged.length + refused.length === 0}
            onClick={() => {
              receive.mutate(
                { id: request.id, items: sound, damaged, refused, refund_shipping: refundShipping },
                {
                  onSuccess: (answer) => {
                    if (sound.length + damaged.length === 0) {
                      // All refused: nothing came back to refund
                      toast.success(t(`${R}.refusedOnly`))
                    } else if (answer.refund_error) {
                      toast.warning(t(`${R}.refundFailed`, { reason: answer.refund_error }))
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
