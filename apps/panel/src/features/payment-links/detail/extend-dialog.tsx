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
import { useExtendPaymentLink } from "@/features/payment-links/api/payment-links"
import type { PaymentLink } from "@/features/payment-links/api/types"
import { MAX_HOURS, MIN_HOURS, hoursOf } from "@/features/payment-links/form"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const X = "paymentLinks.extend"

/**
 * "Uzat": an open link's end set `hours` from now. It never goes past
 * seven days from the link's making (its token's own end): the backend
 * stops there and refuses an end no later than today's.
 */
export function ExtendDialog({ link, onClose }: { link: PaymentLink; onClose: () => void }) {
  const { t } = useTranslation()
  const extend = useExtendPaymentLink(link.id)
  const [text, setText] = useState("24")
  const [failure, setFailure] = useState<string | null>(null)
  const hours = hoursOf(text)
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
            if (hours === null) {
              setFailure(t(`${X}.invalid`, { min: MIN_HOURS, max: MAX_HOURS }))
              return
            }
            setFailure(null)
            extend.mutate(hours, {
              onSuccess: (saved) => {
                toast.success(t(`${X}.done`, { date: formatDateTime(saved.expires_at) }))
                onClose()
              },
              onError: (error) => {
                setFailure(errorText(t, error))
              },
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(`${X}.title`, { number: link.number })}</DialogTitle>
            <DialogDescription>
              {t(`${X}.description`, {
                now: formatDateTime(link.expires_at),
                cap: formatDateTime(link.token_ends_at),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field
              label={t(`${X}.hours`)}
              htmlFor="link-extend-hours"
              hint={t(`${X}.hoursHint`)}
              error={failure ?? undefined}
              required
            >
              <NumberField
                min={MIN_HOURS}
                max={MAX_HOURS}
                id="link-extend-hours"
                className="w-40"
                value={text}
                aria-invalid={failure ? true : undefined}
                onChange={(event) => {
                  setText(event.target.value)
                }}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={extend.isPending}>
              {extend.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${X}.confirm`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
