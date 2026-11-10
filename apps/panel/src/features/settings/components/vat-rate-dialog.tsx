import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
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
import { Input } from "@qticaret/admin-ui/ui/input"
import { useAddVatRate, useUpdateVatRate, vatNameOf } from "@/features/settings/api/vat-rates"
import type { VatRate } from "@/features/settings/api/vat-rates"
import { errorText } from "@/lib/errors"
import { parseDecimalInput } from "@qticaret/admin-ui/lib/money-input"

const V = "settings.vatRates"
const NAME_MAX = 60

/** The percentage typed: 0 to 100, at most two decimals; null otherwise. */
const rateOf = (text: string): number | null => {
  const value = parseDecimalInput(text, 2)
  return value !== null && value >= 0 && value <= 100 ? value : null
}

interface VatRateDialogProps {
  /** The rate to rename; none adds a new one. */
  rate: VatRate | null
  onClose: () => void
}

/**
 * "Oran ekle" and "Yeniden adlandır" (adr/0007 Ek 2026-11-04): a new rate
 * by its percentage, its name offered as "KDV %X" until the owner writes
 * another; or a rate's name, which its product group carries too.
 */
export function VatRateDialog({ rate, onClose }: VatRateDialogProps) {
  const { t } = useTranslation()
  const add = useAddVatRate()
  const update = useUpdateVatRate()
  const [percent, setPercent] = useState("")
  const [name, setName] = useState(rate?.name ?? "")
  // The name follows the percentage until it is written by hand
  const [named, setNamed] = useState(rate !== null)
  // A field's own mistake under it; the server's refusal (a percentage or name in use) under both
  const [failure, setFailure] = useState<{
    field: "rate" | "name" | "form"
    text: string
  } | null>(null)
  const pending = add.isPending || update.isPending
  const value = rateOf(percent)

  const fail = (error: unknown) => {
    setFailure({ field: "form", text: errorText(t, error) })
  }
  const submit = () => {
    const trimmed = name.trim()
    if (!rate && value === null) {
      setFailure({ field: "rate", text: t(`${V}.rateInvalid`) })
      return
    }
    if (trimmed === "" || trimmed.length > NAME_MAX) {
      setFailure({ field: "name", text: t(`${V}.nameInvalid`) })
      return
    }
    setFailure(null)
    if (rate) {
      update.mutate(
        { id: rate.id, name: trimmed },
        {
          onSuccess: () => {
            toast.success(t(`${V}.renamed`))
            onClose()
          },
          onError: fail,
        }
      )
      return
    }
    add.mutate(
      { rate: value ?? 0, name: trimmed },
      {
        onSuccess: () => {
          toast.success(t(`${V}.added`, { name: trimmed }))
          onClose()
        },
        onError: fail,
      }
    )
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
      <DialogContent size="sm">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(rate ? `${V}.renameTitle` : `${V}.addTitle`)}</DialogTitle>
            <DialogDescription>
              {t(rate ? `${V}.renameDescription` : `${V}.addDescription`)}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {rate ? null : (
              <Field
                label={t(`${V}.rate`)}
                htmlFor="vat-rate-percent"
                hint={t(`${V}.rateHint`)}
                error={failure?.field === "rate" ? failure.text : undefined}
                required
              >
                <NumberField
                  id="vat-rate-percent"
                  className="w-40"
                  decimals={2}
                  min={0}
                  max={100}
                  suffix="%"
                  value={percent}
                  aria-invalid={failure?.field === "rate" ? true : undefined}
                  onChange={(event) => {
                    const text = event.target.value
                    setPercent(text)
                    const next = rateOf(text)
                    if (!named) {
                      setName(next === null ? "" : vatNameOf(next))
                    }
                  }}
                />
              </Field>
            )}
            <Field
              label={t(`${V}.name`)}
              htmlFor="vat-rate-name"
              hint={t(`${V}.nameHint`)}
              error={failure?.field === "name" ? failure.text : undefined}
              required
            >
              <Input
                id="vat-rate-name"
                value={name}
                maxLength={NAME_MAX}
                aria-invalid={failure?.field === "name" ? true : undefined}
                onChange={(event) => {
                  setName(event.target.value)
                  setNamed(true)
                }}
              />
            </Field>
            {failure?.field === "form" ? (
              <p role="alert" className="text-sm text-destructive-text">
                {failure.text}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {t(rate ? `${V}.renameConfirm` : `${V}.addConfirm`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
