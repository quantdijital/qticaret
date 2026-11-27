import { useTranslation } from "react-i18next"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import {
  ANNOUNCEMENT_DEFAULTS,
  ANNOUNCEMENT_SETTINGS,
  announcementSettingsOf,
} from "@qticaret/types"
import type { AnnouncementSetting, AnnouncementStep } from "@qticaret/types"
import type { AnnouncementBar } from "@/features/storefront/api/layout"
import { PanelGroup } from "../panel-header"
import { HintedName } from "./field-hint"
import type { FieldGroupName } from "./field-registry"
import { FIELD_IDS } from "./field-registry"
import { announcementOffers } from "./announcement-registry"
import { AlignSketch, SizeSketch } from "./announcement-sketches"
import { LinkField } from "./link-field"
import { StepChoice } from "./step-choice"

const A = "storefront.editor.announcement"

/** The bar's two on/off settings, each drawn as a switch (bilesen-standardi §3). */
type OnOff = "hover_pause" | "arrows"

/** One on/off setting: its name with the term small, its hint behind the name. */
function SwitchOf({
  section,
  setting,
  onChange,
}: {
  section: AnnouncementBar
  setting: OnOff
  onChange: (section: AnnouncementBar) => void
}) {
  const { t } = useTranslation()
  const id = FIELD_IDS.announcement(section.id, setting)
  return (
    <div id={id} className="flex items-start justify-between gap-4">
      <HintedName
        name={t(`${A}.${setting}.label`)}
        hint={t(`${A}.${setting}.hint`)}
        hintId={`${id}-hint`}
      >
        <label htmlFor={`${id}-input`} className="text-sm font-medium">
          {t(`${A}.${setting}.label`)}{" "}
          <small className="text-[11px] font-normal text-muted-foreground">
            {t(`${A}.${setting}.term`)}
          </small>
        </label>
      </HintedName>
      <HiddenHint id={`${id}-hint`}>{t(`${A}.${setting}.hint`)}</HiddenHint>
      <Switch
        id={`${id}-input`}
        aria-describedby={`${id}-hint`}
        checked={announcementSettingsOf(section)[setting] === "on"}
        onCheckedChange={(checked) => {
          onChange({ ...section, [setting]: checked ? "on" : "off" })
        }}
      />
    </div>
  )
}

/** One step setting side by side, its name with the term small, "Varsayılana dön" once changed. */
function StepsOf({
  section,
  setting,
  onChange,
}: {
  section: AnnouncementBar
  setting: Exclude<AnnouncementSetting, OnOff>
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
 * "Hareket" group): how long each stays, whether they fade or slide, the
 * slider's arrows (owner 2026-11-27), when the pause button shows (never
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
  return (
    <PanelGroup name="motion" title={t("storefront.editor.panel.motion")} reveal={reveal("motion")}>
      <div className="flex flex-col gap-5">
        <StepsOf section={section} setting="interval" onChange={onChange} />
        <StepsOf section={section} setting="transition" onChange={onChange} />
        <SwitchOf section={section} setting="arrows" onChange={onChange} />
        <StepsOf section={section} setting="pause_button" onChange={onChange} />
        <SwitchOf section={section} setting="hover_pause" onChange={onChange} />
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
    <PanelGroup
      name="appearance"
      title={t("storefront.editor.panel.appearance")}
      reveal={reveal("appearance")}
    >
      <div className="flex flex-col gap-5">
        <StepsOf section={section} setting="align" onChange={onChange} />
        <StepsOf section={section} setting="size" onChange={onChange} />
        <StepsOf section={section} setting="tone" onChange={onChange} />
        <LinkField
          id={`${section.id}-announcement-link`}
          label={t("storefront.editor.announcement.link.label")}
          hint={t("storefront.editor.announcement.link.hint")}
          link={section.link ?? null}
          onChange={(link) => {
            onChange({ ...section, link })
          }}
        />
      </div>
    </PanelGroup>
  )
}
