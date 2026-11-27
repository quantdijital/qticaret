import { useTranslation } from "react-i18next"
import { TOP_SLIDER_DEFAULTS, TOP_SLIDER_SETTINGS, topSliderSettingsOf } from "@qticaret/types"
import type { TopSliderSetting } from "@qticaret/types"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { MediaField } from "@/components/patterns/media-field"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { TopSlide, TopSliderSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { HintedName } from "./field-hint"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { StepChoice } from "./step-choice"

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
  const problem = useProblemText()
  const settings = topSliderSettingsOf(section)
  const setSlides = (slides: TopSlide[], field?: string) => {
    onChange({ ...section, slides }, field)
  }
  const setSlide = (index: number, slide: Partial<TopSlide>, field?: string) => {
    setSlides(
      section.slides.map((each, at) => (at === index ? { ...each, ...slide } : each)),
      field
    )
  }
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
      {section.slides.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t(`${S}.empty`)}</p>
      ) : null}
      <ol className="flex flex-col gap-4">
        {section.slides.map((slide, index) => {
          const number = index + 1
          const at = `slides.${String(index)}`
          const id = `${section.id}-top-slide-${String(index)}`
          return (
            <li key={index} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t(`${S}.slide`, { number })}</span>
                <RowActions
                  index={index}
                  count={section.slides.length}
                  item={t(`${S}.slide`, { number })}
                  removable
                  onMove={(to) => {
                    const next = section.slides.filter((_, other) => other !== index)
                    next.splice(to, 0, slide)
                    setSlides(next)
                  }}
                  onRemove={() => {
                    setSlides(section.slides.filter((_, other) => other !== index))
                  }}
                />
              </div>
              <ImageField
                id={`${id}-image`}
                label={t(`${S}.image`)}
                hint={t(`${S}.imageHint`)}
                image={slide.image}
                removable={false}
                altError={problem(problems[`${at}.image`], L.alt)}
                onChange={(image) => {
                  if (image) setSlide(index, { image }, `${at}.image`)
                }}
              />
              <ImageField
                id={`${id}-mobile`}
                label={t(`${S}.mobileImage`)}
                hint={t(`${S}.mobileHint`)}
                image={slide.mobile_image}
                altError={problem(problems[`${at}.mobile_image`], L.alt)}
                onChange={(mobile_image) => {
                  setSlide(index, { mobile_image }, `${at}.mobile_image`)
                }}
              />
              <LinkField
                id={`${id}-link`}
                label={t(`${S}.link`)}
                hint={t(`${S}.linkHint`)}
                link={slide.link}
                error={problem(problems[`${at}.link`])}
                onChange={(link, field) => {
                  setSlide(index, { link }, field && `${at}.link.label`)
                }}
              />
            </li>
          )
        })}
      </ol>
      {section.slides.length < L.slides ? (
        <MediaField
          id={`${section.id}-top-slider-add`}
          label={t(`${S}.add`)}
          hint={t(`${S}.addHint`, { max: L.slides })}
          value={null}
          emptyText={t(`${S}.add`)}
          onChange={(asset) => {
            if (asset) {
              setSlides([
                ...section.slides,
                { image: { url: asset.url, alt: asset.alt }, mobile_image: null, link: null },
              ])
            }
          }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t(`${S}.full`, { max: L.slides })}</p>
      )}
      {steps("height")}
      {steps("interval")}
      {steps("transition")}
      {toggle("arrows")}
      {toggle("dots")}
    </div>
  )
}
