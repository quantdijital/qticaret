import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Button } from "@qticaret/admin-ui/ui/button"
import { HintedName } from "./field-hint"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"

const S = "storefront.editor.slider"

/** A choice of a few as one segmented control, its options named. */
export function Choice<T extends string>({
  id,
  label,
  term,
  hint,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  /** The technical term shown small beside the label. */
  term?: string
  hint?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div id={id} className="flex flex-col gap-2">
      <HintedName name={label} hint={hint} hintId={`${id}-hint`}>
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
          {term ? (
            <>
              {" "}
              <small className="text-[11px] font-normal text-muted-foreground">{term}</small>
            </>
          ) : null}
        </span>
      </HintedName>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        {...(hint ? { "aria-describedby": `${id}-hint` } : {})}
        value={value}
        onValueChange={(next) => {
          if (next) {
            onChange(next as T)
          }
        }}
        className="w-full"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hint ? <HiddenHint id={`${id}-hint`}>{hint}</HiddenHint> : null}
    </div>
  )
}

/** The dialog's way to the slide before or after and where it stands ("2 / 4"); shown from two. */
export function SlideStepper({
  index,
  total,
  onGo,
}: {
  index: number
  total: number
  onGo: (to: number) => void
}) {
  const { t } = useTranslation()
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
        disabled={index === 0}
        aria-label={t(`${S}.previous`)}
        onClick={() => {
          onGo(index - 1)
        }}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-10 text-center text-xs text-muted-foreground tabular-nums">
        {t(`${S}.position`, { at: index + 1, total })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={index === total - 1}
        aria-label={t(`${S}.next`)}
        onClick={() => {
          onGo(index + 1)
        }}
      >
        <ChevronRight />
      </Button>
    </>
  )
}
