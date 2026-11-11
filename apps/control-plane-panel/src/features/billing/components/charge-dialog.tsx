import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PAYMENT_METHODS } from "@qticaret/types/control-plane"
import type { PaymentMethod } from "@qticaret/types/control-plane"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { useMe } from "@/features/auth/api"
import { canSettle, isOwner, useChargeAction } from "@/features/billing/api"
import type { Charge, ChargeAction } from "@/features/billing/api"
import { chargeWord, money, periodText } from "@/features/billing/words"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"
import { Facts } from "./facts"

type Mode = "view" | ChargeAction["action"]

const REASON_MIN = 3

/** The facts of a charge: its period, amounts, days and how it was settled. */
function ChargeFacts({ charge }: { charge: Charge }) {
  const { t } = useTranslation()
  const word = chargeWord(t, charge)
  const rows: [string, React.ReactNode][] = [
    [t("billing.charge.status"), <StatusBadge tone={word.tone}>{word.label}</StatusBadge>],
    [t("billing.charge.period"), periodText(charge.period_start, charge.period_end)],
    [t("billing.charge.amount"), money(charge.amount, charge.currency_code)],
    [t("billing.charge.due"), formatDate(charge.due_on)],
    [t("billing.charge.graceEnds"), formatDate(charge.grace_ends_on)],
  ]
  if (charge.amount !== charge.list_amount) {
    rows.push([t("billing.charge.listAmount"), money(charge.list_amount, charge.currency_code)])
    rows.push([t("billing.charge.amountReason"), charge.amount_reason ?? "—"])
  }
  if (charge.status === "paid") {
    rows.push([t("billing.charge.paidOn"), charge.paid_on ? formatDate(charge.paid_on) : "—"])
    rows.push([
      t("billing.charge.method"),
      charge.method ? t(`billing.method.${charge.method}`) : "—",
    ])
    rows.push([t("billing.charge.reference"), charge.reference ?? "—"])
  }
  if (charge.settle_reason) {
    rows.push([t("billing.charge.reason"), charge.settle_reason])
  }
  if (charge.settled_by) {
    rows.push([t("billing.charge.settledBy"), charge.settled_by])
  }
  return <Facts rows={rows} />
}

/**
 * One charge (Ek C16): its facts, and for an open one the actions the
 * role may take, each a small form behind a step-up: "Ödendi" (day, method,
 * reference), "Bağışla" and void (reason), "Tutarı düzelt" (amount, reason).
 */
export function ChargeDialog({
  tenantId,
  charge,
  today,
  onClose,
}: {
  tenantId: string
  charge: Charge
  today: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const me = useMe()
  const change = useChargeAction(tenantId, charge.id)
  const [mode, setMode] = useState<Mode>("view")
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer")
  const [reference, setReference] = useState("")
  const [reason, setReason] = useState("")
  const [amount, setAmount] = useState(formatMoneyInput(charge.amount / 100))
  const [failure, setFailure] = useState<string | null>(null)
  const close = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }
  if (mode === "view") {
    const open = charge.status === "open"
    const actions = [
      ...(open && canSettle(me?.role) ? (["pay", "waive", "amount"] as const) : []),
      ...(open && isOwner(me?.role) ? (["void"] as const) : []),
    ]
    return (
      <DetailDialog
        open
        onOpenChange={close}
        title={t("billing.charge.title", {
          period: periodText(charge.period_start, charge.period_end),
        })}
        footer={
          actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={action === "pay" ? "default" : "outline"}
                  className={action === "void" ? "text-destructive" : undefined}
                  onClick={() => {
                    setMode(action)
                  }}
                >
                  {t(`billing.actions.${action}.open`)}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      >
        <DialogBody>
          <ChargeFacts charge={charge} />
        </DialogBody>
      </DetailDialog>
    )
  }
  const cents = parseMoneyInput(amount)
  const input: ChargeAction =
    mode === "pay"
      ? { action: "pay", body: { paid_on: paidOn, method, reference: reference.trim() } }
      : mode === "amount"
        ? {
            action: "amount",
            body: { amount: Math.round((cents ?? 0) * 100), reason: reason.trim() },
          }
        : { action: mode, body: { reason: reason.trim() } }
  const ready =
    mode === "pay"
      ? paidOn !== "" && paidOn <= today
      : reason.trim().length >= REASON_MIN && (mode !== "amount" || cents !== null)
  return (
    <FormDialog
      open
      onOpenChange={close}
      title={t(`billing.actions.${mode}.title`)}
      description={t(`billing.actions.${mode}.text`, {
        period: periodText(charge.period_start, charge.period_end),
        amount: money(charge.amount, charge.currency_code),
      })}
      dirty
      saving={change.isPending}
      canSubmit={ready}
      submitLabel={t(`billing.actions.${mode}.submit`)}
      onSubmit={() => {
        setFailure(null)
        change.mutate(input, {
          onSuccess: () => {
            toast.success(t(`billing.actions.${mode}.done`))
            onClose()
          },
          onError: (error) => {
            if (!isStepUpCancelled(error)) {
              setFailure(errorText(t, error))
            }
          },
        })
      }}
    >
      <DialogBody>
        {mode === "pay" ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="charge-paid-on">{t("billing.charge.paidOn")}</Label>
              <Input
                id="charge-paid-on"
                type="date"
                max={today}
                value={paidOn}
                onChange={(event) => {
                  setPaidOn(event.target.value)
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p id="charge-method-label" className="text-sm font-medium">
                {t("billing.charge.method")}
              </p>
              <RadioGroup
                aria-labelledby="charge-method-label"
                value={method}
                onValueChange={(next) => {
                  setMethod(next as PaymentMethod)
                }}
                className="flex flex-wrap gap-x-6 gap-y-2"
              >
                {PAYMENT_METHODS.map((each) => (
                  <div key={each} className="flex items-center gap-2">
                    <RadioGroupItem id={`charge-method-${each}`} value={each} />
                    <Label htmlFor={`charge-method-${each}`} className="font-normal">
                      {t(`billing.method.${each}`)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="charge-reference">{t("billing.charge.reference")}</Label>
              <Input
                id="charge-reference"
                maxLength={200}
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value)
                }}
              />
              <p className="text-[13px] text-muted-foreground">
                {t("billing.charge.referenceHelp")}
              </p>
            </div>
          </>
        ) : (
          <>
            {mode === "amount" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="charge-amount">{t("billing.charge.newAmount")}</Label>
                <NumberField
                  id="charge-amount"
                  min={0}
                  decimals={2}
                  suffix="₺"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                  }}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="charge-reason">{t("billing.charge.reason")}</Label>
              <Textarea
                id="charge-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                }}
              />
            </div>
          </>
        )}
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
