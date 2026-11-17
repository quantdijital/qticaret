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
import type { SettleOutcome } from "@/features/orders/api/orders"
import type { ShopRefund } from "@/features/orders/api/payments"
import { errorText } from "@/lib/errors"

const S = "orders.refunds.settle"

const PROVIDERS: Readonly<Record<string, string>> = {
  paytr: "PayTR",
  iyzico: "iyzico",
  "bank-transfer": "Havale/EFT",
  cod: "Kapıda ödeme",
}

const kurusOf = (lira: string) => Math.round(Number(lira) * 100)

// The panel's own refund key (`newRefundReference`): only such a refund is closed in part
const PANEL_REFUND_KEY = /^[0-9a-f]{32}$/

/**
 * An iyzico refund made in part (D4-1): every part answered, together
 * short of the amount; what was given back and what was not, in kuruş.
 * Only shown: the server reads the made part from its own record.
 */
function madeInPartOf(refund: ShopRefund): { done: number; rest: number } | null {
  const parts = refund.parts ?? []
  if (parts.length === 0 || parts.some((part) => part.state !== "done")) {
    return null
  }
  const done = parts.reduce((sum, part) => sum + kurusOf(part.amount), 0)
  const amount = kurusOf(refund.amount)
  return done > 0 && done < amount ? { done, rest: amount - done } : null
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
 * more before it is sent. An iyzico refund made in part (D4-1) is checked
 * against iyzico's panel: its record closed at the part made, what is left
 * shown to be refunded anew, or left open when the figures do not match; a
 * cancel's, a return's or an edit's is left to its flow. Nothing is
 * refunded from here.
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
  const [chosen, setChosen] = useState<SettleOutcome | null>(null)
  const inPart = refund ? madeInPartOf(refund) : null
  const values = {
    amount: refund ? formatMoney(refund.amount, currency) : "",
    done: inPart ? formatMoney(inPart.done / 100, currency) : "",
    rest: inPart ? formatMoney(inPart.rest / 100, currency) : "",
  }
  // A cancel's, a return's or an edit's refund is finished by its flow, never closed in part here
  const flowOwned = refund !== null && !PANEL_REFUND_KEY.test(refund.reference)
  const outcomes: readonly SettleOutcome[] = inPart
    ? flowOwned
      ? []
      : ["made_in_part"]
    : ["not_made", "made"]
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
          toast.success(t(`${S}.done.${chosen}`, values))
          close(false)
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const ask = inPart ? `${S}.in_part` : S
  const hint = inPart && flowOwned ? `${ask}.flow_owned` : `${ask}.hint`
  return (
    <Dialog open={refund !== null} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(chosen ? `${S}.sure.${chosen}` : `${ask}.title`, values)}</DialogTitle>
          <DialogDescription>
            {t(chosen ? `${S}.sure.description` : `${ask}.question`, values)}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {refund ? <RefundFacts refund={refund} currency={currency} /> : null}
          {chosen ? null : (
            <p className="mt-3 text-[13px] text-muted-foreground">{t(hint, values)}</p>
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
            <>
              {/* Made in part, but not as iyzico's panel shows it: left open, nothing written */}
              {inPart && !flowOwned ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    close(false)
                  }}
                >
                  {t(`${S}.in_part.keep_open`)}
                </Button>
              ) : null}
              {outcomes.map((outcome) => (
                <Button
                  key={outcome}
                  variant="outline"
                  onClick={() => {
                    setChosen(outcome)
                  }}
                >
                  {t(`${S}.${outcome}`)}
                </Button>
              ))}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
