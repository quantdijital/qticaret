import { CircleAlert, ImagePlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { EmptyLine, RowActions } from "@/features/settings/components/storefront-rows"
import type { HeroSlide, HeroSliderSection } from "@/features/storefront/api/layout"
import { SLIDER_LIMITS } from "@/features/storefront/api/layout"
import { FIELD_IDS } from "./field-registry"
import { NamedGroup } from "../named-group"
import { FieldGroup } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { Choice } from "./slide-controls"
import { SlideDialog } from "./slide-dialog"
import { useSlideRows } from "./slide-rows"
import { useSlideFocus } from "../use-field-focus"

const S = "storefront.editor.slider"

/** A new slide from a library picture: words on the left, light on a dark picture. */
const slideOf = (image: { url: string; alt: string | null }): HeroSlide => ({
  image: { url: image.url, alt: image.alt },
  mobile_image: null,
  heading: null,
  text: null,
  link: null,
  position: "left",
  tone: "light",
})

/**
 * The home page's sliding opening (adr/0049 Ek 2026-11-06): its slides as
 * rows (a small picture and the heading) that open one dialog each, moved
 * and taken off in place; pictures added from the media library ("İçerik");
 * then how tall it stands ("Seçenekler", closed). How it turns (by
 * itself, arrows, dots, looping) is the scroller kit's, in its own
 * "Kaydırma" group (`SliderGroups`).
 */
export function HeroSliderForm({
  section,
  problems,
  onChange,
}: SectionFormProps<HeroSliderSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  // The field an edit label in the preview named: its slide's dialog opens at it (Faz 2b)
  const [initial, setInitial] = useState<string | null>(null)
  const { rowRef, rowAt } = useSlideRows()
  useSlideFocus((slide, target) => {
    if (slide < section.slides.length) {
      setEditing(slide)
      setInitial(target)
    }
  })
  const set = (next: Partial<HeroSliderSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const setSlides = (slides: HeroSlide[]) => {
    set({ slides })
  }
  const { min, max } = SLIDER_LIMITS.slides
  const full = section.slides.length >= max
  return (
    <>
      <NamedGroup name="content">
        <FieldGroup title={t(`${S}.slides`)} hint={t(`${S}.slidesHint`, { min, max })}>
          {section.slides.length === 0 ? (
            <EmptyLine text={t(`${S}.empty`, { min })} />
          ) : (
            <ol aria-label={t(`${S}.slides`)} className="flex flex-col gap-2">
              {section.slides.map((slide, index) => {
                const item = t(`${S}.slide`, { number: index + 1 })
                const flawed = Object.keys(problems).some((key) =>
                  key.startsWith(`slides.${String(index)}.`)
                )
                return (
                  <li
                    key={`${slide.image.url}-${String(index)}`}
                    className="flex items-center gap-2 rounded-md border p-1.5"
                  >
                    <button
                      ref={rowRef(index)}
                      type="button"
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-sm p-1 text-left transition-colors hover:bg-muted/60"
                      aria-label={t(`${S}.open`, { item })}
                      onClick={() => {
                        setEditing(index)
                      }}
                    >
                      <img
                        src={slide.image.url}
                        alt=""
                        className="aspect-[16/9] w-16 shrink-0 rounded-sm bg-muted object-cover"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-xs text-muted-foreground">{item}</span>
                        <span className="truncate text-sm font-medium">
                          {slide.heading ?? t(`${S}.noHeading`)}
                        </span>
                        {flawed ? (
                          <span className="flex items-center gap-1 text-xs text-destructive-text">
                            <CircleAlert className="size-3" aria-hidden="true" />
                            {t(`${S}.flawed`)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <RowActions
                      index={index}
                      count={section.slides.length}
                      item={item}
                      onMove={(to) => {
                        const next = section.slides.filter((_, at) => at !== index)
                        next.splice(to, 0, slide)
                        setSlides(next)
                      }}
                      onRemove={() => {
                        setSlides(section.slides.filter((_, at) => at !== index))
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start"
            disabled={full}
            onClick={() => {
              setPicking(true)
            }}
          >
            <ImagePlus />
            {t(`${S}.add`)}
          </Button>
        </FieldGroup>
      </NamedGroup>
      <NamedGroup name="options">
        <Choice
          id={FIELD_IDS.content(section.id, "slider_height")}
          label={t(`${S}.height`)}
          term={t(`${S}.heightTerm`)}
          hint={t(`${S}.heightHint.${section.height}`)}
          value={section.height}
          options={(["compact", "regular"] as const).map((value) => ({
            value,
            label: t(`${S}.heights.${value}`),
          }))}
          onChange={(height) => {
            set({ height })
          }}
        />
      </NamedGroup>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, max - section.slides.length)}
        title={t(`${S}.add`)}
        onSelect={(assets) => {
          setSlides([...section.slides, ...assets.map(slideOf)].slice(0, max))
        }}
      />
      {editing !== null && section.slides[editing] ? (
        <SlideDialog
          section={section}
          index={editing}
          onIndexChange={setEditing}
          initialFocus={initial}
          returnFocus={rowAt}
          onSave={(index, slide) => {
            setSlides(section.slides.map((each, at) => (at === index ? slide : each)))
          }}
          onClose={() => {
            setEditing(null)
            setInitial(null)
          }}
        />
      ) : null}
    </>
  )
}
