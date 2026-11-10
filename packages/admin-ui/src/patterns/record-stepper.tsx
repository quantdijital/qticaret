import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"

export interface RecordSteps {
  /** The record's place in the list it was opened from. */
  index: number
  total: number
  /** Goes to another record of the list; the dialog asks first when something is not kept. */
  onGo: (index: number) => void
}

interface RecordStepperProps extends RecordSteps {
  /** What the arrows say to a screen reader: "Önceki varyant", "Sonraki varyant". */
  previousLabel: string
  nextLabel: string
  disabled?: boolean
}

/**
 * ‹ n / m › beside a dialog's title (docs/18 §7): the previous or next
 * record of the list the dialog was opened from, without closing it.
 * Nothing while the list holds only this one.
 */
export function RecordStepper({
  index,
  total,
  onGo,
  previousLabel,
  nextLabel,
  disabled = false,
}: RecordStepperProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  if (total < 2) {
    return null
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index <= 0 || disabled}
        aria-label={previousLabel}
        onClick={() => {
          onGo(index - 1)
        }}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-10 text-center text-xs text-muted-foreground tabular-nums">
        {t("recordStepper.position", { at: index + 1, total })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index >= total - 1 || disabled}
        aria-label={nextLabel}
        onClick={() => {
          onGo(index + 1)
        }}
      >
        <ChevronRight />
      </Button>
    </>
  )
}
