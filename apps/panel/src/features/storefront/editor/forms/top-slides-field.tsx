import { ChevronDown, CircleAlert, ImagePlus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MediaPicker } from "@/components/patterns/media-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { TopSlide } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { useProblemText } from "./problem-text"

const S = "storefront.editor.topSlider"

/**
 * The top image slider's slides (owner 2026-11-27): a row a slide ("1.
 * slayt", its picture small and its words, or a warning without them)
 * that opens its fields in place, one slide open at a time (a new one
 * opens, the others close); moved and taken off on the row. Pictures come
 * from the media library, several at once.
 */
export function TopSlidesField({
  id,
  slides,
  problems,
  onChange,
}: {
  id: string
  slides: readonly TopSlide[]
  problems: SectionProblems
  onChange: (slides: TopSlide[], field?: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const [open, setOpen] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const setSlide = (index: number, slide: Partial<TopSlide>, field?: string) => {
    onChange(
      slides.map((each, at) => (at === index ? { ...each, ...slide } : each)),
      field
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {slides.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t(`${S}.empty`)}</p>
      ) : null}
      <ol aria-label={t(`${S}.slides`)} className="flex flex-col gap-2">
        {slides.map((slide, index) => {
          const number = index + 1
          const item = t(`${S}.slide`, { number })
          const at = `slides.${String(index)}`
          const rowId = `${id}-${String(index)}`
          const expanded = open === index
          const alt = slide.image.alt?.trim() ?? ""
          const flawed = Object.keys(problems).some((key) => key.startsWith(`${at}.`))
          return (
            <li key={`${slide.image.url}-${String(index)}`} className="rounded-md border">
              <div className="flex items-center gap-2 p-1.5">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${rowId}-fields`}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-sm p-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none [html:not([data-input=pointer])_&:focus-visible]:outline-1 [html:not([data-input=pointer])_&:focus-visible]:outline-ring"
                  onClick={() => {
                    setOpen(expanded ? null : index)
                  }}
                >
                  <img
                    src={slide.image.url}
                    alt=""
                    className="aspect-[16/9] w-16 shrink-0 rounded-sm bg-muted object-cover"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-xs text-muted-foreground">{item}</span>
                    {alt !== "" ? (
                      <span className="truncate text-sm font-medium">{alt}</span>
                    ) : (
                      <span className="flex items-center gap-1 truncate text-sm text-destructive-text">
                        <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                        {t(`${S}.noAlt`)}
                      </span>
                    )}
                    {flawed && alt !== "" ? (
                      <span className="flex items-center gap-1 text-xs text-destructive-text">
                        <CircleAlert className="size-3" aria-hidden="true" />
                        {t(`${S}.flawed`)}
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                </button>
                <RowActions
                  index={index}
                  count={slides.length}
                  item={item}
                  removable
                  onMove={(to) => {
                    const next = slides.filter((_, other) => other !== index)
                    next.splice(to, 0, slide)
                    onChange(next)
                    // The open slide moves with its row
                    if (expanded) setOpen(to)
                  }}
                  onRemove={() => {
                    onChange(slides.filter((_, other) => other !== index))
                    setOpen(null)
                  }}
                />
              </div>
              {expanded ? (
                <div id={`${rowId}-fields`} className="flex flex-col gap-4 border-t p-3">
                  <ImageField
                    id={`${rowId}-image`}
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
                    id={`${rowId}-mobile`}
                    label={t(`${S}.mobileImage`)}
                    hint={t(`${S}.mobileHint`)}
                    image={slide.mobile_image}
                    altError={problem(problems[`${at}.mobile_image`], L.alt)}
                    onChange={(mobile_image) => {
                      setSlide(index, { mobile_image }, `${at}.mobile_image`)
                    }}
                  />
                  <LinkField
                    id={`${rowId}-link`}
                    label={t(`${S}.link`)}
                    hint={t(`${S}.linkHint`)}
                    link={slide.link}
                    error={problem(problems[`${at}.link`])}
                    onChange={(link, field) => {
                      setSlide(index, { link }, field && `${at}.link.label`)
                    }}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={slides.length >= L.slides}
        onClick={() => {
          setPicking(true)
        }}
      >
        <ImagePlus />
        {t(`${S}.add`)}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t(slides.length >= L.slides ? `${S}.full` : `${S}.addHint`, { max: L.slides })}
      </p>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        multiple
        max={Math.max(1, L.slides - slides.length)}
        title={t(`${S}.add`)}
        onSelect={(assets) => {
          const added = assets.map((asset) => ({
            image: { url: asset.url, alt: asset.alt },
            mobile_image: null,
            link: null,
          }))
          const next = [...slides, ...added].slice(0, L.slides)
          onChange(next)
          // The first new one opens to write its words; the others close
          if (added.length > 0) setOpen(slides.length)
        }}
      />
    </div>
  )
}
