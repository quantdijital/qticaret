import { CircleAlert, ImageIcon, ImagePlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { HeroCatalogSlide } from "@/features/storefront/api/layout"
import { HERO_CATALOG_LIMITS } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { CatalogSlideDialog } from "./catalog-slide-dialog"
import { isPictureOnly, pictureSlide, slidesOf, withSlides } from "./catalog-slides"
import { FIELD_IDS } from "./field-registry"
import { FieldGroup } from "./fields"
import { useSlideRows } from "./slide-rows"
import type { CatalogHero } from "./slider-kit"
import { useSlideFocus } from "../use-field-focus"

const S = "storefront.editor.slider"
const C = "storefront.editor.heroCatalog"

/**
 * The catalogue opening's slides (adr/0049 Ek 2026-11-15), as the sliding
 * opening lists its own: a row a slide (a small picture and the heading)
 * opening one dialog each, moved and taken off in place (the last one
 * stays), pictures added from the media library as slides of their picture
 * alone. An opening saved before slides shows its own words, buttons and
 * picture as the one slide; how two or more turn is the slider's own
 * "Kaydırma" group.
 */
export function HeroSlidesField({
  section,
  problems,
  onChange,
}: {
  section: CatalogHero
  problems: SectionProblems
  onChange: (section: CatalogHero, field?: string) => void
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  // The field an edit label in the preview named: its slide's dialog opens at it (Faz 2b)
  const [initial, setInitial] = useState<string | null>(null)
  const { rowRef, rowAt } = useSlideRows()
  useSlideFocus((slide, target) => {
    if (slide < slidesOf(section).length) {
      setEditing(slide)
      setInitial(target)
    }
  })
  const slides = slidesOf(section)
  const setSlides = (next: HeroCatalogSlide[]) => {
    onChange(withSlides(section, next))
  }
  const max = HERO_CATALOG_LIMITS.slides
  return (
    <FieldGroup title={t(`${C}.slides`)} hint={t(`${C}.slidesHint`, { max })}>
      <ol
        id={FIELD_IDS.content(section.id, "slides")}
        aria-label={t(`${C}.slides`)}
        className="flex flex-col gap-2"
      >
        {slides.map((slide, index) => {
          const item = t(`${S}.slide`, { number: index + 1 })
          const flawed = Object.keys(problems).some((key) =>
            key.startsWith(`slides.${String(index)}.`)
          )
          return (
            <li
              key={`${slide.image?.url ?? "none"}-${String(index)}`}
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
                {slide.image ? (
                  <img
                    src={slide.image.url}
                    alt=""
                    className="aspect-[16/9] w-16 shrink-0 rounded-sm bg-muted object-cover"
                  />
                ) : (
                  <span className="flex aspect-[16/9] w-16 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                    <ImageIcon className="size-4" aria-hidden="true" />
                  </span>
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted-foreground">{item}</span>
                  <span className="truncate text-sm font-medium">
                    {slide.heading ??
                      t(isPictureOnly(slide) ? `${C}.pictureOnly` : `${S}.noHeading`)}
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
                count={slides.length}
                item={item}
                removable={slides.length > 1}
                onMove={(to) => {
                  const next = slides.filter((_, at) => at !== index)
                  next.splice(to, 0, slide)
                  setSlides(next)
                }}
                onRemove={() => {
                  setSlides(slides.filter((_, at) => at !== index))
                }}
              />
            </li>
          )
        })}
      </ol>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={slides.length >= max}
        onClick={() => {
          setPicking(true)
        }}
      >
        <ImagePlus />
        {t(`${S}.add`)}
      </Button>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, max - slides.length)}
        title={t(`${S}.add`)}
        onSelect={(assets) => {
          setSlides([...slides, ...assets.map(pictureSlide)].slice(0, max))
        }}
      />
      {editing !== null && slides[editing] ? (
        <CatalogSlideDialog
          section={section}
          slides={slides}
          index={editing}
          onIndexChange={setEditing}
          initialFocus={initial}
          returnFocus={rowAt}
          onSave={(index, slide) => {
            setSlides(slides.map((each, at) => (at === index ? slide : each)))
          }}
          onClose={() => {
            setEditing(null)
            setInitial(null)
          }}
        />
      ) : null}
    </FieldGroup>
  )
}
