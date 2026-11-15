import { useTranslation } from "react-i18next"
import { BANNER_TONES } from "@qticaret/types"
import type { BannerSlide } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { Choice } from "./slide-dialog"

const B = "storefront.editor.banner"

/**
 * One picture of the band (adr/0049 Ek 2026-11-14 §3.3 E2): its wide
 * picture and a phone's own, its heading and line, one or two buttons and
 * its words' tone. `field` names what changed for the editor's history.
 */
export function BannerSlideFields({
  id,
  at,
  slide,
  problems,
  onChange,
}: {
  id: string
  /** The slide's place in the section's problems: `slides.0`. */
  at: string
  slide: BannerSlide
  problems: SectionProblems
  onChange: (next: Partial<BannerSlide>, field?: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageField
          id={`${id}-image`}
          label={t(`${F}.image`)}
          image={slide.image}
          removable={false}
          altError={problem(problems[`${at}.image`], L.alt)}
          onChange={(image) => {
            if (image) {
              onChange({ image }, "image")
            }
          }}
        />
        <ImageField
          id={`${id}-phone`}
          label={t(`${B}.mobileImage`)}
          hint={t(`${B}.mobileImageHint`)}
          image={slide.mobile_image}
          altError={problem(problems[`${at}.mobile_image`], L.alt)}
          onChange={(image) => {
            onChange({ mobile_image: image }, "mobile_image")
          }}
        />
      </div>
      <TextField
        id={`${id}-heading`}
        label={t(`${F}.heading`)}
        value={slide.heading}
        max={L.heading}
        tokens
        error={problem(problems[`${at}.heading`], L.heading)}
        onChange={(heading) => {
          onChange({ heading }, "heading")
        }}
      />
      <TextField
        id={`${id}-text`}
        label={t(`${F}.text`)}
        value={slide.text}
        max={L.slideText}
        tokens
        multiline
        error={problem(problems[`${at}.text`], L.slideText)}
        onChange={(text) => {
          onChange({ text }, "text")
        }}
      />
      <LinkField
        id={`${id}-link`}
        label={t(`${B}.link`)}
        hint={t(`${B}.linkHint`)}
        link={slide.link}
        error={problem(problems[`${at}.link`])}
        onChange={(link, field) => {
          onChange({ link }, field && "link.label")
        }}
      />
      <LinkField
        id={`${id}-second_link`}
        label={t(`${B}.secondLink`)}
        hint={t(`${B}.secondLinkHint`)}
        link={slide.second_link}
        error={problem(problems[`${at}.second_link`])}
        onChange={(second_link, field) => {
          onChange({ second_link }, field && "second_link.label")
        }}
      />
      <Choice
        id={`${id}-tone`}
        label={t(`${B}.tone.label`)}
        hint={t(`${B}.tone.hint`)}
        value={slide.tone}
        options={BANNER_TONES.map((value) => ({ value, label: t(`${B}.tone.${value}`) }))}
        onChange={(tone) => {
          onChange({ tone }, "tone")
        }}
      />
    </>
  )
}
