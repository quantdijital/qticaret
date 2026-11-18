import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { HIDE_REASONS } from "@/features/reviews/api/google-reviews"
import type { HideReason } from "@/features/reviews/api/google-reviews"

const G = "reviews.google"

/**
 * "Vitrinden kaldır" for one Google review (adr/0058 Ek): one of the three
 * reasons as radio rows, none chosen at first, and the rule in a line:
 * a review is never taken off for its stars.
 */
export function HideReviewDialog({
  author,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  author: string
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: HideReason) => void
}) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<HideReason | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`${G}.hideTitle`)}</DialogTitle>
          <DialogDescription>{t(`${G}.hideDescription`, { author })}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label={t(`${G}.hideReason`)}
          value={reason ?? ""}
          onValueChange={(value) => {
            setReason(value as HideReason)
          }}
          className="gap-2"
        >
          {HIDE_REASONS.map((each) => (
            <label
              key={each}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem value={each} />
              {t(`${G}.reasons.${each}`)}
            </label>
          ))}
        </RadioGroup>
        <p className="text-[13px] text-muted-foreground">{t(`${G}.hideRule`)}</p>
        <DialogFooter>
          <Button
            variant="cancel"
            onClick={() => {
              setReason(null)
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            disabled={reason === null || busy}
            onClick={() => {
              if (reason) {
                onConfirm(reason)
                setReason(null)
              }
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t(`${G}.hide`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
