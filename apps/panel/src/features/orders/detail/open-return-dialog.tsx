import { CircleAlert, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
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
import { Label } from "@qticaret/admin-ui/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { lineOpen, useOpenReturnRequest } from "@/features/orders/api/returnable"
import type { OpenRequest, Returnable } from "@/features/orders/api/returnable"
import { RETURN_REASONS } from "@/features/orders/api/returns"
import type { ReturnReason } from "@/features/orders/api/returns"
import { NonWithdrawableBadge } from "@/features/orders/components/non-withdrawable-badge"
import { SealedGoodsBadge } from "@/features/orders/components/return-facts"
import { GiftReturnNote } from "@/features/orders/detail/gift-return-dialog"
import { requestProblem } from "@/features/orders/return-rules"
import { errorText } from "@/lib/errors"

const O = "orders.returns.open"

type Kind = OpenRequest["kind"]

interface Pick {
  quantity: number
  variant: string
}

/**
 * A request opened for the shopper who called (F12.3): a return or an
 * exchange, the lines and how many (no more than is left), each exchanged
 * line's new variant, the reason. A gift card line goes on its own, as
 * money back (adr/0025 Ek 2026-11-03). The server checks it all again by
 * the shopper's own rules; the shopper gets the same e-mail as for theirs.
 */
export function OpenReturnDialog({
  orderId,
  returnable,
  onClose,
}: {
  orderId: string
  returnable: Returnable
  onClose: () => void
}) {
  const { t } = useTranslation()
  const open = useOpenReturnRequest(orderId)
  const [kind, setKind] = useState<Kind>("return")
  const [reason, setReason] = useState<ReturnReason | "">("")
  const [note, setNote] = useState("")
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  const lines = returnable.lines.filter(lineOpen)
  const chosen = lines.filter((line) => (picks[line.line_item_id]?.quantity ?? 0) > 0)
  // The server's rules (lib/orders/returns.ts, gift-returns.ts), said before it refuses
  const problem = requestProblem(chosen, kind, reason)
  const giftOnly = problem === null && chosen.length > 0 && chosen.every((line) => line.gift_card)
  const ready =
    chosen.length > 0 &&
    reason !== "" &&
    problem === null &&
    (kind === "return" || chosen.every((line) => picks[line.line_item_id]?.variant))

  const pick = (lineId: string, next: Partial<Pick>) => {
    setPicks((current) => ({
      ...current,
      [lineId]: { quantity: 0, variant: "", ...current[lineId], ...next },
    }))
  }

  const submit = () => {
    if (!ready) {
      return
    }
    open.mutate(
      {
        kind,
        reason,
        items: chosen.map((line) => ({
          line_item_id: line.line_item_id,
          quantity: picks[line.line_item_id]?.quantity ?? 0,
          ...(kind === "exchange" ? { variant_id: picks[line.line_item_id]?.variant ?? "" } : {}),
        })),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t(`${O}.done`))
          onClose()
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(`${O}.title`)}</DialogTitle>
            <DialogDescription>{t(`${O}.description`)}</DialogDescription>
          </DialogHeader>
          <DialogBody list>
            <ToggleGroup
              type="single"
              variant="outline"
              value={kind}
              aria-label={t(`${O}.kind`)}
              onValueChange={(next) => {
                if (next) {
                  setKind(next as Kind)
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="return" className="flex-1">
                {t(`${O}.return`)}
              </ToggleGroupItem>
              <ToggleGroupItem value="exchange" className="flex-1">
                {t(`${O}.exchange`)}
              </ToggleGroupItem>
            </ToggleGroup>
            <DialogSection title={t(`${O}.lines`)}>
              <ul className="flex flex-col divide-y rounded-md border">
                {lines.map((line) => {
                  const current = picks[line.line_item_id]
                  const inputId = `return-qty-${line.line_item_id}`
                  return (
                    <li key={line.line_item_id} className="flex flex-col gap-2 px-3 py-1.5">
                      <div className="flex min-h-9 items-center gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <label htmlFor={inputId} className="truncate text-sm font-medium">
                              {line.title ?? "—"}
                            </label>
                            {line.gift_card ? (
                              <StatusBadge tone="info">{t(`${O}.giftBadge`)}</StatusBadge>
                            ) : null}
                            {line.withdrawal_excluded ? (
                              <NonWithdrawableBadge reason={line.withdrawal_excluded_reason} />
                            ) : null}
                            {line.withdrawal_warning === "sealed_goods" ? (
                              <SealedGoodsBadge />
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {[
                              line.variant_title,
                              t(line.gift_card ? `${O}.leftCards` : `${O}.left`, {
                                count: line.returnable,
                              }),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <NumberField
                          id={inputId}
                          plain
                          size="compact"
                          min={0}
                          max={line.returnable}
                          className="w-24 shrink-0"
                          value={current?.quantity ?? 0}
                          onChange={(event) => {
                            const value = Math.trunc(Number(event.target.value))
                            pick(line.line_item_id, {
                              quantity: Number.isFinite(value)
                                ? Math.min(Math.max(value, 0), line.returnable)
                                : 0,
                            })
                          }}
                        />
                      </div>
                      {kind === "exchange" && !line.gift_card && (current?.quantity ?? 0) > 0 ? (
                        line.variants.length > 0 ? (
                          <Select
                            value={current?.variant ?? ""}
                            onValueChange={(variant) => {
                              pick(line.line_item_id, { variant })
                            }}
                          >
                            <SelectTrigger className="w-full" aria-label={t(`${O}.variant`)}>
                              <SelectValue placeholder={t(`${O}.variant`)} />
                            </SelectTrigger>
                            <SelectContent>
                              {line.variants.map((variant) => (
                                <SelectItem key={variant.id} value={variant.id}>
                                  {variant.title ?? variant.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-warning-text">{t(`${O}.noVariant`)}</p>
                        )
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </DialogSection>
            <div className="flex flex-col gap-2">
              <Label id="return-reason-label">{t(`${O}.reason`)}</Label>
              <Select
                value={reason}
                onValueChange={(next) => {
                  setReason(next as ReturnReason)
                }}
              >
                <SelectTrigger className="w-full" aria-labelledby="return-reason-label">
                  <SelectValue placeholder={t(`${O}.reasonPlaceholder`)} />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`orders.returns.reasons.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {problem ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t(`${O}.${problem}`)}
              </p>
            ) : null}
            {giftOnly ? <GiftReturnNote /> : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="return-note">{t(`${O}.note`)}</Label>
              <Textarea
                id="return-note"
                maxLength={1000}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value)
                }}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="cancel" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!ready || open.isPending}>
              {open.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${O}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
