import { useTranslation } from "react-i18next"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import {
  ANNOUNCEMENT_DEFAULTS,
  ANNOUNCEMENT_SETTINGS,
  announcementSettingsOf,
} from "@qticaret/types"
import type { AnnouncementSetting, AnnouncementStep } from "@qticaret/types"
import type { AnnouncementBar } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import type { FieldGroupName } from "./field-registry"
import { FIELD_IDS } from "./field-registry"
import { announcementOffers } from "./announcement-registry"
import { AlignSketch, SizeSketch } from "./announcement-sketches"
import { StepChoice } from "./step-choice"

const A = "storefront.editor.announcement"

/** One step setting side by side, its name with the term small, "Varsayılana dön" once changed. */
function StepsOf({
  section,
  setting,
  onChange,
}: {
  section: AnnouncementBar
  setting: Exclude<AnnouncementSetting, "hover_pause">
  onChange: (section: AnnouncementBar) => void
}) {
  const { t } = useTranslation()
  const steps: readonly string[] = ANNOUNCEMENT_SETTINGS[setting]
  return (
    <StepChoice
      id={FIELD_IDS.announcement(section.id, setting)}
      label={t(`${A}.${setting}.label`)}
      term={t(`${A}.${setting}.term`)}
      hint={t(`${A}.${setting}.hint`, { defaultValue: "" }) || undefined}
      steps={steps}
      value={announcementSettingsOf(section)[setting]}
      fallback={ANNOUNCEMENT_DEFAULTS[setting]}
      nameOf={(step) => t(`${A}.${setting}.${step}`)}
      drawOf={
        setting === "align"
          ? (step) => <AlignSketch step={step as AnnouncementStep<"align">} />
          : setting === "size"
            ? (step) => <SizeSketch step={step as AnnouncementStep<"size">} />
            : undefined
      }
      onChange={(step) => {
        onChange({ ...section, [setting]: step })
      }}
    />
  )
}

/** How the bar shows more than one line: under its lines, in the open content group. */
export function AnnouncementMode({
  section,
  onChange,
}: {
  section: AnnouncementBar
  onChange: (section: AnnouncementBar) => void
}) {
  return announcementOffers(section, "mode") ? (
    <StepsOf section={section} setting="mode" onChange={onChange} />
  ) : null
}

/**
 * How the lines take turns (bilesen-standardi §4.5, all in the open
 * "Hareket" group): how long each stays, when the pause button shows (never
 * taken away) and whether the pointer stops them. Only while they turn.
 */
export function AnnouncementMotion({
  section,
  reveal,
  onChange,
}: {
  section: AnnouncementBar
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: AnnouncementBar) => void
}) {
  const { t } = useTranslation()
  if (!announcementOffers(section, "interval")) {
    return null
  }
  const id = FIELD_IDS.announcement(section.id, "hover_pause")
  return (
    <PanelGroup title={t("storefront.editor.panel.motion")} reveal={reveal("motion")}>
      <div className="flex flex-col gap-5">
        <StepsOf section={section} setting="interval" onChange={onChange} />
        <StepsOf section={section} setting="pause_button" onChange={onChange} />
        <div id={id} className="flex items-start justify-between gap-4">
          <label htmlFor={`${id}-input`} className="flex flex-col gap-0.5 text-sm font-medium">
            <span>
              {t(`${A}.hover_pause.label`)}{" "}
              <small className="text-[11px] font-normal text-muted-foreground">
                {t(`${A}.hover_pause.term`)}
              </small>
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t(`${A}.hover_pause.hint`)}
            </span>
          </label>
          <Switch
            id={`${id}-input`}
            checked={announcementSettingsOf(section).hover_pause === "on"}
            onCheckedChange={(checked) => {
              onChange({ ...section, hover_pause: checked ? "on" : "off" })
            }}
          />
        </div>
      </div>
    </PanelGroup>
  )
}

/**
 * Where the bar's lines sit and how big it is (adr/0049 Ek 2026-11-15), in
 * the open "Stil" group, whatever the lines: "Hizalama" Otomatik (as
 * before: centred on a phone, at the start on a wide screen) / Sol / Orta /
 * Sağ, "Boyut" Küçük / Orta / Büyük.
 */
export function AnnouncementStyle({
  section,
  reveal,
  onChange,
}: {
  section: AnnouncementBar
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: AnnouncementBar) => void
}) {
  const { t } = useTranslation()
  return (
    <PanelGroup title={t("storefront.editor.panel.appearance")} reveal={reveal("appearance")}>
      <div className="flex flex-col gap-5">
        <StepsOf section={section} setting="align" onChange={onChange} />
        <StepsOf section={section} setting="size" onChange={onChange} />
      </div>
    </PanelGroup>
  )
}
