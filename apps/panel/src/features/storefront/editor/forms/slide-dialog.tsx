import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { HeroSlide, HeroSliderSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"

const S = "storefront.editor.slider"

const same = (a: HeroSlide, b: HeroSlide) => JSON.stringify(a) === JSON.stringify(b)

/** A choice of a few as one segmented control, its options named. */
export function Choice<T extends string>({
  id,
  label,
  term,
  hint,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  /** The technical term shown small beside the label. */
  term?: string
  hint?: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div id={id} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
        {term ? (
          <>
            {" "}
            <small className="text-[11px] font-normal text-muted-foreground">{term}</small>
          </>
        ) : null}
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        {...(hint ? { "aria-describedby": `${id}-hint` } : {})}
        value={value}
        onValueChange={(next) => {
          if (next) {
            onChange(next as T)
          }
        }}
        className="w-full"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="flex-1 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * One slide of the sliding opening in the panel's standard dialog (rows
 * open one dialog; docs/18 §7): its wide picture and a phone's own, its
 * heading, line and one button, where its words stand and in which tone.
 * "Kaydet" puts it into the draft; the arrows step to the slide before or
 * after (asking first when something is unsaved).
 */
export function SlideDialog({
  section,
  index,
  onIndexChange,
  onSave,
  onClose,
}: {
  section: HeroSliderSection
  index: number
  onIndexChange: (index: number) => void
  onSave: (index: number, slide: HeroSlide) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const saved = section.slides[index]
  const [slide, setSlide] = useState<HeroSlide | undefined>(saved)
  const dirty = Boolean(saved && slide && !same(saved, slide))
  const guard = useDiscardGuard(dirty)
  if (!saved || !slide) {
    return null
  }
  const total = section.slides.length
  const at = `slides.${String(index)}`
  // The slide's mistakes as the section would meet them
  const problems = sectionProblems({
    ...section,
    slides: section.slides.map((each, place) => (place === index ? slide : each)),
  })
  const own = Object.keys(problems).filter((key) => key.startsWith(`${at}.`))
  const set = (next: Partial<HeroSlide>) => {
    setSlide({ ...slide, ...next })
  }
  const go = (to: number) => {
    const next = section.slides[to]
    if (!next) {
      return
    }
    guard.guard(() => {
      setSlide(next)
      onIndexChange(to)
    })
  }
  const id = `hero-slide-${String(index)}`
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      size="lg"
      pane="fixed"
      title={t(`${S}.editSlide`)}
      description={slide.heading ?? t(`${S}.slide`, { number: index + 1 })}
      headerAction={
        total > 1 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === 0}
              aria-label={t(`${S}.previous`)}
              onClick={() => {
                go(index - 1)
              }}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-10 text-center text-xs text-muted-foreground tabular-nums">
              {t(`${S}.position`, { at: index + 1, total })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={index === total - 1}
              aria-label={t(`${S}.next`)}
              onClick={() => {
                go(index + 1)
              }}
            >
              <ChevronRight />
            </Button>
          </>
        ) : null
      }
      dirty={dirty}
      saving={false}
      onSubmit={() => {
        // A mistake stays in sight beside its field; nothing is put in the draft yet
        if (own.length === 0) {
          onSave(index, slide)
          onClose()
        }
      }}
      guard={guard}
    >
      <DialogBody>
        <DialogSection title={t(`${S}.pictures`)}>
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageField
              id={`${id}-image`}
              label={t(`${S}.image`)}
              hint={t(`${S}.imageHint`)}
              image={slide.image}
              removable={false}
              altError={problem(problems[`${at}.image`], L.alt)}
              onChange={(image) => {
                if (image) {
                  set({ image })
                }
              }}
            />
            <ImageField
              id={`${id}-phone`}
              label={t(`${S}.mobileImage`)}
              hint={t(`${S}.mobileImageHint`)}
              image={slide.mobile_image}
              altError={problem(problems[`${at}.mobile_image`], L.alt)}
              onChange={(image) => {
                set({ mobile_image: image })
              }}
            />
          </div>
        </DialogSection>
        <DialogSection title={t(`${S}.words`)}>
          <TextField
            id={`${id}-heading`}
            label={t(`${F}.heading`)}
            value={slide.heading}
            max={L.heading}
            tokens
            hint={t(`${S}.headingHint`)}
            error={problem(problems[`${at}.heading`], L.heading)}
            onChange={(heading) => {
              set({ heading })
            }}
          />
          <TextField
            id={`${id}-text`}
            label={t(`${F}.text`)}
            value={slide.text}
            max={L.slideText}
            tokens
            multiline
            hint={t(`${S}.textHint`)}
            error={problem(problems[`${at}.text`], L.slideText)}
            onChange={(text) => {
              set({ text })
            }}
          />
          <LinkField
            id={`${id}-link`}
            label={t(`${S}.button`)}
            hint={t(`${S}.buttonHint`)}
            link={slide.link}
            error={problem(problems[`${at}.link`])}
            onChange={(link) => {
              set({ link })
            }}
          />
        </DialogSection>
        <DialogSection title={t(`${S}.look`)}>
          <Choice
            id={`${id}-position`}
            label={t(`${S}.positionLabel`)}
            value={slide.position}
            options={(["left", "center", "right"] as const).map((value) => ({
              value,
              label: t(`${S}.positions.${value}`),
            }))}
            onChange={(position) => {
              set({ position })
            }}
          />
          <Choice
            id={`${id}-tone`}
            label={t(`${S}.toneLabel`)}
            hint={t(`${S}.toneHint`)}
            value={slide.tone}
            options={(["light", "dark"] as const).map((value) => ({
              value,
              label: t(`${S}.tones.${value}`),
            }))}
            onChange={(tone) => {
              set({ tone })
            }}
          />
        </DialogSection>
      </DialogBody>
    </FormDialog>
  )
}
