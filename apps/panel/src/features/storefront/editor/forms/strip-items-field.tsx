import { CircleAlert, ImageIcon, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { STRIP_GALLERY_LIMITS } from "@qticaret/types"
import type { StripRecordKind } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import { EmptyLine, RowActions } from "@/features/settings/components/storefront-rows"
import type { StripGallerySection, StripItem } from "@/features/storefront/api/layout"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { FieldGroup } from "./fields"
import { useProblemText } from "./problem-text"
import { useRecordNames } from "./record-names"
import { useSlideRows } from "./slide-rows"
import { StripItemDialog } from "./strip-item-dialog"
import { newStripItem, targetOf } from "./strip-items"
import { useSlideFocus } from "../use-field-focus"

const G = "storefront.editor.stripGallery"
const S = "storefront.editor.slider"

/** The names of the records the strips name, read kind by kind. */
function useStripNames(items: readonly StripItem[]): (item: StripItem) => string | null {
  const ids = (kind: StripRecordKind) =>
    items.flatMap((item) => {
      const target = targetOf(item)
      return item.source.kind === kind && target ? [target] : []
    })
  const product = useRecordNames("product", ids("product"))
  const category = useRecordNames("category", ids("category"))
  const collection = useRecordNames("collection", ids("collection"))
  const brand = useRecordNames("brand", ids("brand"))
  const byKind = { product, category, collection, brand }
  return (item) => {
    const target = targetOf(item)
    return item.source.kind === "custom" || !target
      ? null
      : (byKind[item.source.kind].data?.[target] ?? null)
  }
}

/**
 * The strip gallery's strips (adr/0049 Ek 2026-11-16), as the sliding
 * opening lists its slides: a row a strip (its own picture small, its
 * heading or its record's name, its source's kind) opening one dialog
 * each, moved and taken off in place. "Şerit ekle" adds a product strip
 * and opens it; at eight it is closed and says so.
 */
export function StripItemsField({
  section,
  problems,
  onChange,
}: {
  section: StripGallerySection
  problems: SectionProblems
  onChange: (section: StripGallerySection, field?: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const [editing, setEditing] = useState<number | null>(null)
  // The field an edit label in the preview named: its strip's dialog opens at it (Faz 2b)
  const [initial, setInitial] = useState<string | null>(null)
  const { rowRef, rowAt } = useSlideRows()
  const nameOf = useStripNames(section.items)
  useSlideFocus((slide, target) => {
    if (slide < section.items.length) {
      setEditing(slide)
      setInitial(target)
    }
  })
  const setItems = (items: StripItem[]) => {
    onChange({ ...section, items })
  }
  const { min, max } = STRIP_GALLERY_LIMITS.items
  const full = section.items.length >= max
  return (
    <FieldGroup title={t(`${G}.items`)} hint={t(`${G}.itemsHint`, { min, max })}>
      {section.items.length === 0 ? (
        <EmptyLine text={t(`${G}.empty`, { min })} />
      ) : (
        <ol aria-label={t(`${G}.items`)} className="flex flex-col gap-2">
          {section.items.map((item, index) => {
            const label = t(`${G}.item`, { number: index + 1 })
            const flawed = Object.keys(problems).some((key) =>
              key.startsWith(`items.${String(index)}.`)
            )
            const shown = item.title ?? nameOf(item)
            return (
              <li
                key={`${item.source.kind}-${String(index)}`}
                className="flex items-center gap-2 rounded-md border p-1.5"
              >
                <button
                  ref={rowRef(index)}
                  type="button"
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-sm p-1 text-left transition-colors hover:bg-muted/60"
                  aria-label={t(`${S}.open`, { item: label })}
                  onClick={() => {
                    setEditing(index)
                  }}
                >
                  {item.image ? (
                    <img
                      src={item.image.url}
                      alt=""
                      className="aspect-[3/4] w-9 shrink-0 rounded-sm bg-muted object-cover"
                    />
                  ) : (
                    <span className="flex aspect-[3/4] w-9 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                      <ImageIcon className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs text-muted-foreground">
                      {label} · {t(`${G}.kinds.${item.source.kind}`)}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {shown ?? t(`${G}.noTitle`)}
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
                  count={section.items.length}
                  item={label}
                  onMove={(to) => {
                    const next = section.items.filter((_, at) => at !== index)
                    next.splice(to, 0, item)
                    setItems(next)
                  }}
                  onRemove={() => {
                    setItems(section.items.filter((_, at) => at !== index))
                  }}
                />
              </li>
            )
          })}
        </ol>
      )}
      {problems["items"] ? (
        <p role="alert" className="text-xs text-destructive-text">
          {problem(problems["items"])}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={full}
          onClick={() => {
            setItems([...section.items, newStripItem()])
            setEditing(section.items.length)
          }}
        >
          <Plus />
          {t(`${G}.add`)}
        </Button>
        {full ? (
          <span className="text-xs text-muted-foreground">{t(`${G}.full`, { max })}</span>
        ) : null}
      </div>
      {editing !== null && section.items[editing] ? (
        <StripItemDialog
          section={section}
          index={editing}
          onIndexChange={setEditing}
          initialFocus={initial}
          returnFocus={rowAt}
          onSave={(index, item) => {
            setItems(section.items.map((each, at) => (at === index ? item : each)))
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
