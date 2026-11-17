import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { FieldGroupName } from "./forms/field-registry"
import { PANEL_GROUPS } from "./panel-groups"
import { PanelGroup } from "./panel-header"

/**
 * A section's group by its name in `PANEL_GROUPS`: its title from there,
 * so the panel, a hit's second line and the editor's search say the same.
 * A form that splits its content (the opening's buttons, the cards, the
 * questions' opening) draws these itself, "İçerik" (`content`) first.
 */
export function NamedGroup({
  name,
  hint,
  children,
}: {
  name: FieldGroupName
  /** What the group holds, behind the (i) beside its title. */
  hint?: string | undefined
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup name={name} title={t(PANEL_GROUPS[name].title)} hint={hint}>
      {children}
    </PanelGroup>
  )
}
