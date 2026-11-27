import { useTranslation } from "react-i18next"
import { TOP_SLIDER_DEFAULTS, TOP_SLIDER_SETTINGS, topSliderSettingsOf } from "@qticaret/types"
import type { TopSliderSetting } from "@qticaret/types"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { TopSliderSection } from "@/features/storefront/api/layout"
import { HintedName } from "./field-hint"
import type { SectionFormProps } from "./form-props"
import { StepChoice } from "./step-choice"
import { TopSlidesField } from "./top-slides-field"

const S = "storefront.editor.topSlider"

/** The slider's on/off settings, each a switch (bilesen-standardi §3). */
type OnOff = "arrows" | "dots"

/**
 * The top image slider's form (owner 2026-11-27): its pictures in order,
 * each with its words for screen readers (required), a phone's own crop
 * and a link, added from the media library; then the band's height, how
 * long each stays, how it gives way, its arrows and dots.
 */
export function TopSliderForm({ section, problems, onChange }: SectionFormProps<TopSliderSection>) {
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
  return (
    <div className="flex flex-col gap-5">
      <TopSlidesField
        id={`${section.id}-top-slides`}
        slides={section.slides}
        problems={problems}
        onChange={(slides, field) => {
          onChange({ ...section, slides }, field)
        }}
      />
      {steps("height")}
      {steps("interval")}
      {steps("transition")}
      {toggle("arrows")}
      {toggle("dots")}
    </div>
  )
}
