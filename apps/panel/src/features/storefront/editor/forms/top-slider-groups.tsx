import { useTranslation } from "react-i18next"
import { TOP_SLIDER_DEFAULTS, TOP_SLIDER_SETTINGS, topSliderSettingsOf } from "@qticaret/types"
import type { TopSliderSetting } from "@qticaret/types"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { TopSliderSection } from "@/features/storefront/api/layout"
import { HintedName } from "./field-hint"
import type { FieldGroupName } from "./field-registry"
import { StepChoice } from "./step-choice"
import { PanelGroup } from "../panel-header"

const S = "storefront.editor.topSlider"

/** The slider's on/off settings, each a switch (bilesen-standardi §3). */
type OnOff = "arrows" | "dots"

/**
 * The top image slider's look in the "Stil" tab (owner 2026-11-27), as
 * every section's: its height in "Diziliş", how long each picture stays
 * and how it gives way in "Hareket", its arrows and dots in "Ok ve nokta
 * görünümü". Its pictures are the "İçerik" tab's (`TopSliderForm`).
 */
export function TopSliderGroups({
  section,
  reveal,
  onChange,
}: {
  section: TopSliderSection
  reveal: (group: FieldGroupName) => number | null
  onChange: (section: TopSliderSection) => void
}) {
  const { t } = useTranslation()
  const settings = topSliderSettingsOf(section)
  const steps = (setting: Exclude<TopSliderSetting, OnOff>) => {
    const list: readonly string[] = TOP_SLIDER_SETTINGS[setting]
    return (
      <StepChoice
        id={`${section.id}-top-slider-${setting}`}
        label={t(`${S}.${setting}.label`)}
        term={t(`${S}.${setting}.term`)}
        hint={t(`${S}.${setting}.hint`)}
        steps={list}
        value={settings[setting]}
        fallback={TOP_SLIDER_DEFAULTS[setting]}
        nameOf={(step) => t(`${S}.${setting}.${step}`)}
        onChange={(step) => {
          onChange({ ...section, [setting]: step })
        }}
      />
    )
  }
  const toggle = (setting: OnOff) => {
    const id = `${section.id}-top-slider-${setting}`
    return (
      <div id={id} className="flex items-start justify-between gap-4">
        <HintedName
          name={t(`${S}.${setting}.label`)}
          hint={t(`${S}.${setting}.hint`)}
          hintId={`${id}-hint`}
        >
          <label htmlFor={`${id}-input`} className="text-sm font-medium">
            {t(`${S}.${setting}.label`)}{" "}
            <small className="text-[11px] font-normal text-muted-foreground">
              {t(`${S}.${setting}.term`)}
            </small>
          </label>
        </HintedName>
        <HiddenHint id={`${id}-hint`}>{t(`${S}.${setting}.hint`)}</HiddenHint>
        <Switch
          id={`${id}-input`}
          aria-describedby={`${id}-hint`}
          checked={settings[setting] === "on"}
          onCheckedChange={(checked) => {
            onChange({ ...section, [setting]: checked ? "on" : "off" })
          }}
        />
      </div>
    )
  }
  const P = "storefront.editor.panel"
  return (
    <>
      <PanelGroup name="layout" title={t(`${P}.layout`)} reveal={reveal("layout")}>
        {steps("height")}
      </PanelGroup>
      <PanelGroup name="motion" title={t(`${P}.motion`)} reveal={reveal("motion")}>
        <div className="flex flex-col gap-5">
          {steps("interval")}
          {steps("transition")}
        </div>
      </PanelGroup>
      <PanelGroup name="controls" title={t(`${P}.groups.controls`)} reveal={reveal("controls")}>
        <div className="flex flex-col gap-5">
          {toggle("arrows")}
          {toggle("dots")}
        </div>
      </PanelGroup>
    </>
  )
}
