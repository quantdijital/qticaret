import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { STRIP_GALLERY_LIMITS } from "@qticaret/types"
import type { StripItem, StripGallerySection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"
import { RecordField } from "./record-fields"
import { useRecordNames } from "./record-names"
import { Choice, SlideStepper } from "./slide-controls"
import { STRIP_SOURCE_KINDS, targetOf, withKind, withTarget } from "./strip-items"
import { TextField } from "./fields"

const G = "storefront.editor.stripGallery"

const same = (a: StripItem, b: StripItem) => JSON.stringify(a) === JSON.stringify(b)

/**
 * One strip of the strip gallery (adr/0049 Ek 2026-11-16) in the panel's
 * standard dialog: where it takes what is left empty (a product, a
 * category, a collection, a brand, or none) and its record; then, whatever
 * the source, the shop's own picture, heading, line and link, each hint
 * saying what an empty one shows. Changing the source keeps them.
 * "Kaydet" puts it into the draft; the arrows step to the strip before or
 * after (asking first when something is unsaved).
 */
export function StripItemDialog({
  section,
  index,
  onIndexChange,
  onSave,
  onClose,
  initialFocus = null,
  returnFocus,
}: {
  section: StripGallerySection
  index: number
  onIndexChange: (index: number) => void
  onSave: (index: number, item: StripItem) => void
  onClose: () => void
  /** The element the dialog opens at (a field the preview named); null: its first. */
  initialFocus?: string | null
  /** The element the caret goes back to on closing, by the strip shown (`useSlideRows`). */
  returnFocus?: (index: number) => HTMLElement | null
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const saved = section.items[index]
  const [item, setItem] = useState<StripItem | undefined>(saved)
  const dirty = Boolean(saved && item && !same(saved, item))
  const guard = useDiscardGuard(dirty)
  const { kind } = item?.source ?? { kind: "custom" }
  const target = item ? targetOf(item) : null
  const names = useRecordNames(kind === "custom" ? "product" : kind, target ? [target] : [])
  if (!saved || !item) {
    return null
  }
  const name = target ? (names.data?.[target] ?? null) : null
  const total = section.items.length
  const at = `items.${String(index)}`
  const id = (part: string) => PREVIEW_IDS.text(section.id, `${at}.${part}`)
  // The strip's mistakes as the section would meet them
  const problems = sectionProblems({
    ...section,
    items: section.items.map((each, place) => (place === index ? item : each)),
  })
  const own = Object.keys(problems).filter((key) => key.startsWith(`${at}.`))
  const set = (next: Partial<StripItem>) => {
    setItem({ ...item, ...next })
  }
  const go = (to: number) => {
    const next = section.items[to]
    if (!next) {
      return
    }
    guard.guard(() => {
      setItem(next)
      onIndexChange(to)
    })
  }
  const kindName = t(`${G}.kinds.${kind}`)
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
      title={t(`${G}.editItem`)}
      description={item.title ?? name ?? t(`${G}.item`, { number: index + 1 })}
      headerAction={total > 1 ? <SlideStepper index={index} total={total} onGo={go} /> : null}
      dirty={dirty}
      saving={false}
      onSubmit={() => {
        // A mistake stays in sight beside its field; nothing is put in the draft yet
        if (own.length === 0) {
          onSave(index, item)
          onClose()
        }
      }}
      initialFocus={initialFocus}
      returnFocus={() => returnFocus?.(index) ?? null}
      guard={guard}
    >
      <DialogBody>
        <DialogSection title={t(`${G}.source`)}>
          <Choice
            id={id("kind")}
            label={t(`${G}.kind`)}
            hint={t(`${G}.kindHint`)}
            value={kind}
            options={STRIP_SOURCE_KINDS.map((value) => ({
              value,
              label: t(`${G}.kinds.${value}`),
            }))}
            onChange={(next) => {
              setItem(withKind(item, next))
            }}
          />
          {item.source.kind === "custom" ? null : (
            <RecordField
              key={item.source.kind}
              kind={item.source.kind}
              label={kindName}
              id={item.source.target}
              error={problem(problems[`${at}.source`])}
              onChange={(next) => {
                setItem(withTarget(item, next))
              }}
            />
          )}
        </DialogSection>
        <DialogSection title={t(`${G}.own`)}>
          <p className="text-xs text-muted-foreground">{t(`${G}.ownHint`)}</p>
          <ImageField
            id={id("image")}
            label={t(`${G}.image`)}
            hint={t(`${G}.imageHint.${kind}`)}
            image={item.image}
            altError={problem(problems[`${at}.image`], L.alt)}
            onChange={(image) => {
              set({ image })
            }}
          />
          {problems[`${at}.image`] === "imageRequired" ? (
            <p role="alert" className="-mt-2 text-xs text-destructive-text">
              {problem("imageRequired")}
            </p>
          ) : null}
          <TextField
            id={id("title")}
            label={t(`${G}.title`)}
            value={item.title}
            max={STRIP_GALLERY_LIMITS.title}
            tokens
            placeholder={name ? t(`${G}.emptyAs`, { value: name }) : undefined}
            hint={t(`${G}.titleHint.${kind}`)}
            error={problem(problems[`${at}.title`], STRIP_GALLERY_LIMITS.title)}
            onChange={(title) => {
              set({ title })
            }}
          />
          <TextField
            id={id("note")}
            label={t(`${G}.note`)}
            value={item.note}
            max={STRIP_GALLERY_LIMITS.note}
            tokens
            hint={t(`${G}.noteHint.${kind}`)}
            error={problem(problems[`${at}.note`], STRIP_GALLERY_LIMITS.note)}
            onChange={(note) => {
              set({ note })
            }}
          />
          <LinkField
            id={id("link")}
            label={t(`${G}.link`)}
            hint={t(`${G}.linkHint.${kind}`)}
            link={item.link}
            error={problem(problems[`${at}.link`])}
            onChange={(link) => {
              set({ link })
            }}
          />
        </DialogSection>
      </DialogBody>
    </FormDialog>
  )
}
