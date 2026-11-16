import { useTranslation } from "react-i18next"
import type { HeaderMarquee, MarqueeSection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import type { FieldGroupName } from "./field-registry"
import { MARQUEE_APPEARANCE_SETTINGS, MARQUEE_MOTION_SETTINGS } from "./field-registry"
import { MarqueeSettings } from "./marquee-settings"

/**
 * A scrolling strip's two open groups under its items (adr/0049 Ek
 * 2026-11-15): "Hareket" (speed, way, stopping under the pointer, the
 * pause button) and "Stil" (size, ground, separator, weight, capitals,
 * room, the large size's outline). Its rarely changed settings sit closed
 * in "Diğer ayarlar" (`SectionPanel`).
 */
export function MarqueeGroups<S extends MarqueeSection | HeaderMarquee>({
  section,
  reveal,
  onChange,
}: {
  section: S
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: S) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <PanelGroup
        name="motion"
        title={t("storefront.editor.panel.motion")}
        reveal={reveal("motion")}
      >
        <MarqueeSettings section={section} settings={MARQUEE_MOTION_SETTINGS} onChange={onChange} />
      </PanelGroup>
      <PanelGroup
        name="appearance"
        title={t("storefront.editor.panel.appearance")}
        reveal={reveal("appearance")}
      >
        <MarqueeSettings
          section={section}
          settings={MARQUEE_APPEARANCE_SETTINGS}
          onChange={onChange}
        />
      </PanelGroup>
    </>
  )
}
