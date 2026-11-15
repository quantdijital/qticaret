import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import type { HeroSlide, HeroSliderSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { Choice, SlideStepper } from "./slide-controls"

const S = "storefront.editor.slider"

const same = (a: HeroSlide, b: HeroSlide) => JSON.stringify(a) === JSON.stringify(b)

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
  initialFocus = null,
}: {
  section: HeroSliderSection
  index: number
  onIndexChange: (index: number) => void
  onSave: (index: number, slide: HeroSlide) => void
  onClose: () => void
  /** The element the dialog opens at (a field the preview named); null: its first. */
  initialFocus?: string | null
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
      headerAction={total > 1 ? <SlideStepper index={index} total={total} onGo={go} /> : null}
      dirty={dirty}
      saving={false}
      onSubmit={() => {
        // A mistake stays in sight beside its field; nothing is put in the draft yet
        if (own.length === 0) {
          onSave(index, slide)
          onClose()
        }
      }}
      initialFocus={initialFocus}
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
