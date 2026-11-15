import { useTranslation } from "react-i18next"
import {
  STRIP_GALLERY_DEFAULTS,
  STRIP_GALLERY_SETTINGS,
  stripGallerySettingsOf,
} from "@qticaret/types"
import type { StripGallerySettings } from "@qticaret/types"
import type { StripGallerySection } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"

const G = "storefront.editor.stripGallery"

/** The settings drawn as steps, in the panel's order; the overlap and the darkening are switches. */
const STRIP_STEP_SETTINGS = [
  "width",
  "height",
  "captions",
  "strips_slant",
  "strips_line",
] as const satisfies readonly (keyof StripGallerySettings)[]

const STRIP_SWITCH_SETTINGS = [
  "strips_overlap",
  "strips_dim",
] as const satisfies readonly (keyof StripGallerySettings)[]

/**
 * The strip gallery's open "Diziliş" group (docs/tema/bilesen-standardi
 * §1): its width and height, the words over the strips, the seams' slant
 * and line as steps, the overlap and the darkening as switches, each
 * with its reset and in the settings search. The strips' look has the
 * featured product's names, steps and defaults, so the two read alike.
 */
export function StripGalleryGroups({
  section,
  reveal,
  onChange,
}: {
  section: StripGallerySection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: StripGallerySection) => void
}) {
  const { t } = useTranslation()
  const settings = stripGallerySettingsOf(section)
  const set = (next: Partial<StripGallerySettings>) => {
    onChange({ ...section, ...next })
  }
  return (
    <PanelGroup title={t("storefront.editor.panel.layout")} reveal={reveal("layout")}>
      {STRIP_STEP_SETTINGS.map((name) => (
        <StepChoice<string>
          key={name}
          id={FIELD_IDS.content(section.id, name)}
          label={t(`${G}.${name}.label`)}
          term={t(`${G}.${name}.term`)}
          hint={t(`${G}.${name}.hint`)}
          steps={STRIP_GALLERY_SETTINGS[name]}
          value={settings[name]}
          fallback={STRIP_GALLERY_DEFAULTS[name]}
          nameOf={(step) => t(`${G}.${name}.${step}`)}
          onChange={(step) => {
            set({ [name]: step })
          }}
        />
      ))}
      {STRIP_SWITCH_SETTINGS.map((name) => (
        <SwitchRow
          key={name}
          id={FIELD_IDS.content(section.id, name)}
          label={t(`${G}.${name}.label`)}
          term={t(`${G}.${name}.term`)}
          hint={t(`${G}.${name}.hint`)}
          checked={settings[name] === "on"}
          onChange={(on) => {
            set({ [name]: on ? "on" : "off" })
          }}
        />
      ))}
    </PanelGroup>
  )
}
