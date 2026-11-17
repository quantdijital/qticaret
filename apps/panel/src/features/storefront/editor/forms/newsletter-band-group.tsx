import { useTranslation } from "react-i18next"
import type { AnySection, FooterNewsletter } from "@/features/storefront/api/layout"
import { PANEL_GROUPS } from "../panel-groups"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { CONTENT_IDS } from "./content-registry"
import { withJoined } from "./newsletter-band"

const N = "storefront.editor.newsletter"

/**
 * The footer box's band under "Stil", in "Yeri" (adr/0070 §4 Ek): on the free rows
 * footer's ground as its top band, as the ledger and the brand columns draw
 * it, or above the footer as a page's box (off, as it was). The other
 * footers draw the band inside them either way, which the hint says.
 */
export function NewsletterBandGroup({
  section,
  reveal,
  onChange,
}: {
  section: FooterNewsletter
  reveal: number | null
  onChange: (section: AnySection, field?: string) => void
}) {
  const { t } = useTranslation()
  const joined = section.joined === true
  return (
    <PanelGroup
      name="placement"
      title={t(PANEL_GROUPS.placement.title)}
      marked={Number(joined)}
      reveal={reveal}
    >
      <div id={CONTENT_IDS.content(section.id, "joined")}>
        <SwitchRow
          id={`${section.id}-joined`}
          label={t(`${N}.joined`)}
          term={t(`${N}.joinedTerm`)}
          hint={t(`${N}.joinedHint`)}
          checked={joined}
          onChange={(next) => {
            // Off is the field's absence: the box reads as it did before the setting
            onChange(withJoined(section, next), "joined")
          }}
        />
      </div>
    </PanelGroup>
  )
}
