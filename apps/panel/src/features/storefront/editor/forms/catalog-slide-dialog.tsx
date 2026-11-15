import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import type { HeroCatalogSlide } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { withSlides } from "./catalog-slides"
import { F, TextField } from "./fields"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { useProblemText } from "./problem-text"
import { SlideStepper } from "./slide-dialog"
import type { CatalogHero } from "./slider-kit"

const S = "storefront.editor.slider"
const C = "storefront.editor.heroCatalog"

const same = (a: HeroCatalogSlide, b: HeroCatalogSlide) => JSON.stringify(a) === JSON.stringify(b)

/**
 * One slide of the catalogue opening (adr/0049 Ek 2026-11-15) in the
 * sliding opening's dialog: its picture and where the picture leads, its
 * heading, line and up to two buttons. With no words the slide is the
 * picture alone. "Kaydet" puts it into the draft; the arrows step to the
 * slide before or after (asking first when something is unsaved).
 */
export function CatalogSlideDialog({
  section,
  slides,
  index,
  onIndexChange,
  onSave,
  onClose,
  initialFocus = null,
}: {
  section: CatalogHero
  slides: HeroCatalogSlide[]
  index: number
  onIndexChange: (index: number) => void
  onSave: (index: number, slide: HeroCatalogSlide) => void
  onClose: () => void
  /** The element the dialog opens at (a field the preview named); null: its first. */
  initialFocus?: string | null
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const saved = slides[index]
  const [slide, setSlide] = useState<HeroCatalogSlide | undefined>(saved)
  const dirty = Boolean(saved && slide && !same(saved, slide))
  const guard = useDiscardGuard(dirty)
  if (!saved || !slide) {
    return null
  }
  const total = slides.length
  const at = `slides.${String(index)}`
  // The slide's mistakes as the section would meet them
  const problems = sectionProblems(
    withSlides(
      section,
      slides.map((each, place) => (place === index ? slide : each))
    )
  )
  const own = Object.keys(problems).filter((key) => key.startsWith(`${at}.`))
  const set = (next: Partial<HeroCatalogSlide>) => {
    setSlide({ ...slide, ...next })
  }
  const go = (to: number) => {
    const next = slides[to]
    if (!next) {
      return
    }
    guard.guard(() => {
      setSlide(next)
      onIndexChange(to)
    })
  }
  const [first, second] = slide.links
  const setButton = (place: 0 | 1, link: HeroCatalogSlide["link"]) => {
    const links = place === 0 ? [link, second] : [first, link]
    set({ links: links.flatMap((each) => (each ? [each] : [])) })
  }
  const id = `${section.id}-slide-${String(index)}`
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
          <ImageField
            id={`${id}-image`}
            label={t(`${S}.image`)}
            hint={t(index === 0 ? `${C}.slideImageFirstHint` : `${C}.slideImageHint`)}
            image={slide.image}
            altError={problem(problems[`${at}.image`], L.alt)}
            onChange={(image) => {
              set({ image })
            }}
          />
          <LinkField
            id={`${id}-link`}
            label={t(`${C}.slideLink`)}
            term={t(`${C}.slideLinkTerm`)}
            hint={t(`${C}.slideLinkHint`)}
            link={slide.link}
            error={problem(problems[`${at}.link`])}
            onChange={(link) => {
              set({ link })
            }}
          />
        </DialogSection>
        <DialogSection title={t(`${S}.words`)}>
          <p className="text-xs text-muted-foreground">{t(`${C}.slideWordsHint`)}</p>
          <TextField
            id={`${id}-heading`}
            label={t(`${F}.heading`)}
            value={slide.heading}
            max={L.heading}
            tokens
            error={problem(problems[`${at}.heading`], L.heading)}
            onChange={(heading) => {
              set({ heading })
            }}
          />
          <TextField
            id={`${id}-text`}
            label={t(`${F}.text`)}
            value={slide.text}
            max={L.text}
            tokens
            multiline
            error={problem(problems[`${at}.text`], L.text)}
            onChange={(text) => {
              set({ text })
            }}
          />
          <LinkField
            id={`${id}-button-0`}
            label={t("storefront.editor.hero.button", { number: 1 })}
            link={first ?? null}
            error={problem(problems[`${at}.links.0`])}
            onChange={(link) => {
              setButton(0, link)
            }}
          />
          {first ? (
            <LinkField
              id={`${id}-button-1`}
              label={t("storefront.editor.hero.button", { number: 2 })}
              link={second ?? null}
              error={problem(problems[`${at}.links.1`])}
              onChange={(link) => {
                setButton(1, link)
              }}
            />
          ) : null}
        </DialogSection>
      </DialogBody>
    </FormDialog>
  )
}
