import { useQuery } from "@tanstack/react-query"
import { CircleDollarSign, Loader2 } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { refundPreviewQuery, useRefundOrder } from "@/features/orders/api/orders"
import type { OrderDetail, OrderMoney } from "@/features/orders/api/orders"
import {
  newRefundReference,
  refundRequest,
  refundableUnits,
  shippingLeft,
} from "@/features/orders/refund"
import type { RefundMode } from "@/features/orders/refund"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { errorText } from "@/lib/errors"
import { formatMoney } from "@qticaret/admin-ui/lib/format"

const R = "orders.refund"

interface RefundDialogProps {
  order: OrderDetail
  money: OrderMoney
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * "Para iadesi" (F5 V5): units of the order's lines and its shipping, or a
 * free amount. The amount comes from the server's preview, the same rule
 * the refund follows; the dialog's own key makes a refund tried again
 * happen once. The page remounts it each time it opens.
 */
export function RefundDialog({ order, money, open, onOpenChange }: RefundDialogProps) {
  const { t } = useTranslation()
  const refund = useRefundOrder(order.id)
  const [reference] = useState(newRefundReference)
  const [mode, setMode] = useState<RefundMode>("items")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [shipping, setShipping] = useState(false)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const request = useDeferredValue(refundRequest(mode, quantities, shipping, amount))
  const preview = useQuery(refundPreviewQuery(order.id, request))
  const byId = new Map(order.items.map((item) => [item.id, item]))
  const lines = money.lines.filter((line) => line.kind === "item" && refundableUnits(line) > 0)
  const shippingLeftover = shippingLeft(money)
  const currency = money.currency_code
  const ready = request !== null && preview.data !== undefined && !preview.isFetching

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent pane>
        <DialogHeader>
          <DialogTitle>{t(`${R}.title`, { number: order.display_id })}</DialogTitle>
          <DialogDescription>
            {t(`${R}.description`, { refundable: formatMoney(money.refundable, currency) })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody list>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label={t(`${R}.mode`)}
            value={mode}
            onValueChange={(next) => {
              if (next) {
                setMode(next as RefundMode)
              }
            }}
            className="w-full"
          >
            {(["items", "amount"] as const).map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="flex-1 px-3 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
              >
                {t(`${R}.modes.${option}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {mode === "items" ? (
            <div className="flex flex-col gap-3">
              <ul className="relative flex flex-col divide-y rounded-md border">
                {lines.map((line) => {
                  const item = byId.get(line.id)
                  const max = refundableUnits(line)
                  return (
                    <li key={line.id} className="flex min-h-12 items-center gap-3 px-3 py-1.5">
                      <ProductThumb src={item?.thumbnail} className="size-9" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{item?.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t(`${R}.left`, { count: max })}
                        </span>
                      </span>
                      <NumberField
                        plain
                        size="compact"
                        min={0}
                        max={max}
                        aria-label={t(`${R}.quantity`, { name: item?.title ?? line.id })}
                        className="w-24 shrink-0"
                        value={quantities[line.id] ?? 0}
                        onChange={(event) => {
                          const next = Math.min(
                            Math.max(Math.trunc(Number(event.target.value) || 0), 0),
                            max
                          )
                          setQuantities((current) => ({ ...current, [line.id]: next }))
                        }}
                      />
                    </li>
                  )
                })}
              </ul>
              {shippingLeftover > 0 ? (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={shipping}
                    onCheckedChange={(checked) => {
                      setShipping(checked === true)
                    }}
                  />
                  {t(`${R}.shipping`, { amount: formatMoney(shippingLeftover, currency) })}
                </label>
              ) : null}
            </div>
          ) : (
            <Field
              label={t(`${R}.amount`)}
              htmlFor="refund-amount"
              hint={t(`${R}.amountHint`, { refundable: formatMoney(money.refundable, currency) })}
            >
              <NumberField
                id="refund-amount"
                decimals={2}
                min={0}
                max={Number(money.refundable)}
                suffix="₺"
                className="sm:w-48"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                }}
              />
            </Field>
          )}
          <Field label={t(`${R}.note`)} htmlFor="refund-note" hint={t(`${R}.noteHint`)}>
            <Textarea
              placeholder={t("orders.placeholders.refundNote")}
              id="refund-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
              }}
            />
          </Field>
          {preview.error ? (
            <Alert variant="destructive">
              <AlertDescription>{errorText(t, preview.error)}</AlertDescription>
            </Alert>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="cancel"
            disabled={refund.isPending}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!ready || refund.isPending}
            onClick={() => {
              if (!request) {
                return
              }
              refund.mutate(
                { ...request, reference, ...(note.trim() ? { note: note.trim() } : {}) },
                {
                  onSuccess: () => {
                    toast.success(t(`${R}.done`))
                    onOpenChange(false)
                  },
                  onError: (failure) => toast.error(errorText(t, failure)),
                }
              )
            }}
          >
            {refund.isPending ? <Loader2 className="animate-spin" /> : <CircleDollarSign />}
            {preview.data && request
              ? t(`${R}.confirm`, { amount: formatMoney(preview.data.amount, currency) })
              : t(`${R}.choose`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
