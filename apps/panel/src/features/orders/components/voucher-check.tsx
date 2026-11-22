import { Link } from "@tanstack/react-router"
import { CircleCheck, CircleX, TicketCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { useVoucherCheck } from "@/features/orders/api/vouchers"
import type { VoucherCheck } from "@/features/orders/api/vouchers"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"

const V = "orders.vouchers"

function CheckResult({ result }: { result: VoucherCheck }) {
  const { t } = useTranslation()
  if (result.status === "unknown") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-destructive">
        <CircleX className="size-4 shrink-0" aria-hidden="true" />
        {t(`${V}.unknown`)}
      </p>
    )
  }
  const valid = result.status === "valid"
  return (
    <div role="status" className="flex flex-col gap-3 rounded-md border p-3">
      <p
        className={`flex items-center gap-2 text-sm font-medium ${valid ? "text-success-text" : "text-destructive"}`}
      >
        {valid ? (
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <CircleX className="size-4 shrink-0" aria-hidden="true" />
        )}
        {t(valid ? `${V}.valid` : `${V}.cancelled`)}
      </p>
      <ul className="flex flex-col gap-2 text-[13px]">
        {result.departures.map((departure) => (
          <li key={departure.starts_at + departure.title} className="flex flex-col">
            <span className="font-medium">{departure.title}</span>
            <span className="text-muted-foreground">
              {departure.when} · {t(`${V}.units`, { count: departure.units })}
            </span>
            {departure.cancelled ? (
              <span className="text-destructive">{t(`${V}.departure_cancelled`)}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <Link
        to="/orders/$id"
        params={{ id: result.order_id }}
        className="text-[13px] font-medium underline-offset-4 hover:underline"
      >
        {t(`${V}.order`, { number: result.order_number })} · {t(`${V}.open_order`)}
      </Link>
    </div>
  )
}

/**
 * "Voucher doğrula" (adr/0076 Ek D7b): staff type the code on a booking's
 * voucher at the departure and see whether it stands. Every role that
 * reads orders; the server counts and records each check. Shown while
 * the shop sells dated products.
 */
export function VoucherCheckButton() {
  const { t } = useTranslation()
  const on = useFeature(BOOKING_FLAG)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const check = useVoucherCheck()
  if (!on) {
    return null
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        <TicketCheck aria-hidden="true" />
        {t(`${V}.title`)}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setCode("")
            check.reset()
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t(`${V}.title`)}</DialogTitle>
            <DialogDescription>{t(`${V}.description`)}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (code.trim() !== "") {
                check.mutate(code.trim())
              }
            }}
          >
            <Label htmlFor="voucher-code">{t(`${V}.code`)}</Label>
            <div className="flex gap-2">
              <Input
                id="voucher-code"
                value={code}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                onChange={(event) => {
                  setCode(event.target.value)
                }}
              />
              <Button type="submit" disabled={check.isPending || code.trim() === ""}>
                {t(`${V}.check`)}
              </Button>
            </div>
          </form>
          {check.error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorText(t, check.error)}
            </p>
          ) : null}
          {check.data ? <CheckResult result={check.data} /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
