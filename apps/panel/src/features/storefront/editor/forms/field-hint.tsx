import type { ReactNode } from "react"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"

/**
 * A setting's name as the editor's own rows draw it (a switch, a row of
 * steps): the name, its term small beside it, then the (i) holding what
 * the setting does (docs/18 §7.1). The words themselves stay in the page,
 * hidden (`HiddenHint` with `hintId`), as the control's description.
 */
export function HintedName({
  name,
  hint,
  hintId,
  children,
}: {
  /** The setting's name, as the (i) is called after it. */
  name: string
  hint: ReactNode
  hintId: string
  /** The name as the row draws it (a `label`, a `span` a group is labelled by). */
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-1.5">
      {children}
      {hint ? <InfoTip name={name} hint={hint} hintId={hintId} /> : null}
    </div>
  )
}
