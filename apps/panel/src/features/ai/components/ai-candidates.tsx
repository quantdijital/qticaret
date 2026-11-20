import { useId } from "react"
import { useTranslation } from "react-i18next"
import { Label } from "@qticaret/admin-ui/ui/label"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"

export interface AiCandidatesProps {
  /** The candidates the gate let through, the strongest first (adr/0074 §4). */
  candidates: readonly string[]
  value: string
  onChange: (candidate: string) => void
}

/**
 * Several candidates for one short field (a search title, a keyword): a
 * radio list, the first picked; "Kullan" below takes the picked one.
 * One candidate is shown as a plain text by the box instead.
 */
export function AiCandidates({ candidates, value, onChange }: AiCandidatesProps) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      aria-label={t("ai.suggest.choices")}
      className="gap-2"
    >
      {candidates.map((candidate, index) => (
        <div key={candidate} className="flex items-start gap-2">
          <RadioGroupItem id={`${id}-${String(index)}`} value={candidate} className="mt-0.5" />
          <Label
            htmlFor={`${id}-${String(index)}`}
            className="block min-w-0 flex-1 cursor-pointer font-normal break-words"
          >
            {candidate}
            {index === 0 ? (
              <span className="ml-1.5 text-xs whitespace-nowrap text-muted-foreground">
                {t("ai.suggest.mainChoice")}
              </span>
            ) : null}
          </Label>
        </div>
      ))}
    </RadioGroup>
  )
}
