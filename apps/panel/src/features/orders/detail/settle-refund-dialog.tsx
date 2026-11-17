import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatDateTime, formatMoney } from "@qticaret/admin-ui/lib/format"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { useSettleRefund } from "@/features/orders/api/orders"
import type { ShopRefund } from "@/features/orders/api/payments"
import { errorText } from "@/lib/errors"

const S = "orders.refunds.settle"

type Outcome = "made" | "not_made"

const PROVIDERS: Readonly<Record<string, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  "bank-transfer": "Havale/EFT",
  cod: "Kapıda ödeme",
}

/** What staff look for in the provider's panel: who, which reference, how much, when, its parts. */
function RefundFacts({ refund, currency }: { refund: ShopRefund; currency: string }) {
  const { t } = useTranslation()
  const rows: [string, string][] = [
    [t(`${S}.provider`), PROVIDERS[refund.provider ?? ""] ?? refund.provider ?? "—"],
    [t(`${S}.reference`), refund.sent_as ?? refund.reference],
    [t(`${S}.amount`), formatMoney(refund.amount, currency)],
    [t(`${S}.date`), formatDateTime(refund.created_at)],
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-all font-medium tabular-nums">{value}</dd>
        </div>
      ))}
      {(refund.parts ?? []).length > 0 ? (
        <div className="contents">
          <dt className="text-muted-foreground">{t(`${S}.parts`)}</dt>
          <dd>
            <ul className="flex flex-col gap-0.5">
              {(refund.parts ?? []).map((part, index) => (
                <li key={index} className="tabular-nums">
                  {formatMoney(part.amount, currency)} ·{" "}
                  {t(`${S}.part.${part.state === "done" ? "done" : "sending"}`)}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  )
}

/**
 * A refund whose record stayed incomplete, checked by staff in the
 * provider's panel (review 2026-11-17, O2, D-4): what to look for is
 * shown; the two answers weigh the same, and the one chosen is asked once
 * more before it is sent. Nothing is refunded from here.
 */
export function SettleRefundDialog({
  orderId,
  refund,
  currency,
  onOpenChange,
}: {
  orderId: string
  refund: ShopRefund | null
  currency: string
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const settle = useSettleRefund(orderId)
  const [chosen, setChosen] = useState<Outcome | null>(null)
  const close = (open: boolean) => {
    if (!open) {
      setChosen(null)
    }
    onOpenChange(open)
  }
  const confirm = () => {
    if (!refund || !chosen) {
      return
    }
    settle.mutate(
      { reference: refund.reference, outcome: chosen },
      {
        onSuccess: () => {
          toast.success(t(`${S}.done.${chosen}`))
          close(false)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  return (
    <Dialog open={refund !== null} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(chosen ? `${S}.sure.${chosen}` : `${S}.title`)}</DialogTitle>
          <DialogDescription>
            {t(chosen ? `${S}.sure.description` : `${S}.question`)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {refund ? <RefundFacts refund={refund} currency={currency} /> : null}
          {chosen ? null : (
            <p className="mt-3 text-[13px] text-muted-foreground">{t(`${S}.hint`)}</p>
          )}
        </DialogBody>
        <DialogFooter>
          {chosen ? (
            <>
              <Button
                variant="outline"
                disabled={settle.isPending}
                onClick={() => {
                  setChosen(null)
                }}
              >
                {t(`${S}.back`)}
              </Button>
              <Button disabled={settle.isPending} onClick={confirm}>
                {settle.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${S}.confirm`)}
              </Button>
            </>
          ) : (
            (["not_made", "made"] as const).map((outcome) => (
              <Button
                key={outcome}
                variant="outline"
                onClick={() => {
                  setChosen(outcome)
                }}
              >
                {t(`${S}.${outcome}`)}
              </Button>
            ))
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
