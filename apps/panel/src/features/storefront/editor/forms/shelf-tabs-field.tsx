import { useTranslation } from "react-i18next"
import { shelfTabsOf } from "@qticaret/types"
import type { ShelfTabs } from "@qticaret/types"
import type { ProductsSection } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { sectionLabel } from "../section-meta"

const SH = "storefront.editor.shelf"

/**
 * Whether the rail joins the rails beside it in one tabbed shelf
 * (bilesen-denetimi (b) 2): on (`auto`, the look before the setting) or set
 * apart (`off`). Its note, shown under it (what it does now), names the rails it joins, or
 * says it joins one put next to it, or that it stands alone.
 */
export function ShelfTabsField({
  id,
  value,
  mates,
  onChange,
}: {
  id: string
  value: ProductsSection["tabs"]
  mates: readonly ProductsSection[]
  onChange: (tabs: ShelfTabs) => void
}) {
  const { t } = useTranslation()
  const on = shelfTabsOf(value) === "auto"
  const names = mates.map((mate) => `«${sectionLabel(t, mate).name}»`).join(", ")
  const note = !on
    ? t(`${SH}.tabsApart`)
    : names === ""
      ? t(`${SH}.tabsAlone`)
      : t(`${SH}.tabsJoined`, { names })
  return (
    <div id={id}>
      <SwitchRow
        id={`${id}-input`}
        label={t(`${SH}.tabs`)}
        term={t(`${SH}.tabsTerm`)}
        note={note}
        checked={on}
        onChange={(checked) => {
          onChange(checked ? "auto" : "off")
        }}
      />
    </div>
  )
}
