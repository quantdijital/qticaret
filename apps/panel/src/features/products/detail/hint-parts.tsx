import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useFieldHintStyle } from "@qticaret/admin-ui/hooks/use-field-hints"
import { HiddenHint, InfoTip } from "@qticaret/admin-ui/patterns/info-tip"

/**
 * A switch row's name and what it does (docs/18 §7.1): the words as a
 * line under the name, or, under `FieldHints style="tip"`, behind a small
 * (i) beside it. Either way they keep `hintId`, the switch's description.
 */
export function SwitchName({
  htmlFor,
  label,
  term,
  hint,
  hintId,
}: {
  htmlFor: string
  label: string
  /** A technical term small beside the name ("booking_mode"). */
  term?: string
  hint: string
  hintId: string
}) {
  const tip = useFieldHintStyle() === "tip"
  const name = (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {label}
    </label>
  )
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {term || tip ? (
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {name}
          {term ? <small className="text-[11px] text-muted-foreground">{term}</small> : null}
          {tip ? <InfoTip name={label} hint={hint} hintId={hintId} className="self-start" /> : null}
        </div>
      ) : (
        name
      )}
      {tip ? (
        <HiddenHint id={hintId}>{hint}</HiddenHint>
      ) : (
        <span id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

/**
 * A form's opening sentence on what its fields are for: a line, or under
 * `FieldHints style="tip"` a short "Ne işe yarar?" with the words behind
 * an (i). A state said with it (`state`, "Girilmedi; varsayılan paket
 * kullanılır") always shows, the (i) beside it.
 */
export function FormNote({
  name,
  hint,
  state,
}: {
  /** The form's name, as the (i) is called after it. */
  name: string
  hint: string
  state?: ReactNode
}) {
  const { t } = useTranslation()
  if (useFieldHintStyle() !== "tip") {
    return (
      <p className="text-[13px] text-muted-foreground">
        {hint}
        {state ? <> {state}</> : null}
      </p>
    )
  }
  return (
    <div className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
      <span>{state ?? t("products.detail.aboutForm")}</span>
      <InfoTip name={name} hint={hint} />
    </div>
  )
}
