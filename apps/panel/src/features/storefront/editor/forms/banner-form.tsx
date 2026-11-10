import { ImagePlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { EmptyLine, RowActions } from "@/features/settings/components/storefront-rows"
import type { BannerSection, BannerSlide } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"

const B = "storefront.editor.banner"

/** Images that slide in turn, each with a heading, a line and a link of its own. */
export function BannerForm({ section, problems, onChange }: SectionFormProps<BannerSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const setSlides = (slides: BannerSlide[], field?: string) => {
    onChange({ ...section, slides }, field)
  }
  const setSlide = (index: number, next: Partial<BannerSlide>, field?: string) => {
    setSlides(
      section.slides.map((slide, at) => (at === index ? { ...slide, ...next } : slide)),
      field ? `slides.${String(index)}.${field}` : undefined
    )
  }
  // A slide starts from its image: there is none without one
  const [picking, setPicking] = useState(false)
  const full = section.slides.length >= L.slides
  return (
    <div className="flex flex-col gap-4">
      {section.slides.length === 0 ? (
        <EmptyLine text={t(`${B}.empty`)} />
      ) : (
        <ol className="flex flex-col gap-4">
          {section.slides.map((slide, index) => {
            const at = `slides.${String(index)}`
            const id = `banner-slide-${String(index)}`
            const item = t(`${B}.slide`, { number: index + 1 })
            return (
              <li
                key={`${slide.image.url}-${String(index)}`}
                className="flex flex-col gap-3 rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  <h4 className="min-w-0 flex-1 text-sm font-medium">{item}</h4>
                  <RowActions
                    index={index}
                    count={section.slides.length}
                    item={item}
                    onMove={(to) => {
                      const next = section.slides.filter((_, each) => each !== index)
                      next.splice(to, 0, slide)
                      setSlides(next)
                    }}
                    onRemove={() => {
                      setSlides(section.slides.filter((_, each) => each !== index))
                    }}
                  />
                </div>
                <ImageField
                  id={`${id}-image`}
                  label={t(`${F}.image`)}
                  image={slide.image}
                  removable={false}
                  altError={problem(problems[`${at}.image`], L.alt)}
                  onChange={(image) => {
                    if (image) {
                      setSlide(index, { image }, "image")
                    }
                  }}
                />
                <TextField
                  id={`${id}-heading`}
                  label={t(`${F}.heading`)}
                  value={slide.heading}
                  max={L.heading}
                  tokens
                  error={problem(problems[`${at}.heading`], L.heading)}
                  onChange={(heading) => {
                    setSlide(index, { heading }, "heading")
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
                    setSlide(index, { text }, "text")
                  }}
                />
                <LinkField
                  id={`${id}-link`}
                  label={t(`${B}.link`)}
                  hint={t(`${B}.linkHint`)}
                  link={slide.link}
                  error={problem(problems[`${at}.link`])}
                  onChange={(link, field) => {
                    setSlide(index, { link }, field && "link.label")
                  }}
                />
              </li>
            )
          })}
        </ol>
      )}
      {problems["slides"] ? (
        <p role="alert" className="text-xs text-destructive-text">
          {problem(problems["slides"])}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={full}
          onClick={() => {
            setPicking(true)
          }}
        >
          <ImagePlus />
          {t(`${B}.add`)}
        </Button>
        <span className="text-xs text-muted-foreground">{t(`${B}.hint`, { max: L.slides })}</span>
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, L.slides - section.slides.length)}
        title={t(`${B}.add`)}
        onSelect={(assets) => {
          setSlides([
            ...section.slides,
            ...assets.map((asset) => ({
              image: { url: asset.url, alt: asset.alt },
              heading: null,
              text: null,
              link: null,
            })),
          ])
        }}
      />
    </div>
  )
}
