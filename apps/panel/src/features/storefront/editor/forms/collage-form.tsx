import { useTranslation } from "react-i18next"
import { ListFooter, RowActions } from "@/features/settings/components/storefront-rows"
import { PHOTO_COLLAGE_LIMITS } from "@qticaret/types"
import type { PhotoCollageItem, PhotoCollageSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { ImageField } from "./image-field"
import { LinkField } from "./link-field"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const S = "storefront.editor.photoCollage"

/**
 * The photo collage's content (adr/0077 §10): an optional title and intro,
 * three to seven photographs in order, each a library picture with the
 * words that describe it (required), an optional caption and an optional
 * link. How they stand is in "Diziliş" (`CollageGroups`), their ground and
 * alignment in "Görünüm".
 */
export function CollageForm({
  section,
  problems,
  onChange,
}: SectionFormProps<PhotoCollageSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const { min, max } = PHOTO_COLLAGE_LIMITS.items
  const setItems = (items: PhotoCollageItem[], field?: string) => {
    onChange({ ...section, items }, field)
  }
  const setItem = (index: number, next: Partial<PhotoCollageItem>, field: string) => {
    setItems(
      section.items.map((item, at) => (at === index ? { ...item, ...next } : item)),
      `items.${String(index)}.${field}`
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={`${section.id}-title`}
        label={t(`${F}.title`)}
        term={t(`${F}.titleTerm`)}
        value={section.title}
        max={L.title}
        hint={t(`${S}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "intro")}
        label={t(`${S}.intro`)}
        value={section.intro}
        max={PHOTO_COLLAGE_LIMITS.intro}
        tokens
        multiline
        error={problem(problems["intro"], PHOTO_COLLAGE_LIMITS.intro)}
        onChange={(intro) => {
          onChange({ ...section, intro }, "intro")
        }}
      />
      <ol aria-label={t(`${S}.items`)} className="flex flex-col gap-3">
        {section.items.map((item, index) => {
          const number = index + 1
          const at = `items.${String(index)}`
          const name = t(`${S}.item`, { number })
          return (
            <li key={index} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{name}</span>
                <RowActions
                  index={index}
                  count={section.items.length}
                  item={name}
                  removable={section.items.length > min}
                  onMove={(to) => {
                    const next = section.items.filter((_, place) => place !== index)
                    next.splice(to, 0, item)
                    setItems(next)
                  }}
                  onRemove={() => {
                    setItems(section.items.filter((_, place) => place !== index))
                  }}
                />
              </div>
              <ImageField
                id={PREVIEW_IDS.text(section.id, `${at}.image`)}
                label={t(`${S}.image`, { number })}
                hint={
                  (item.image ? undefined : problem(problems[`${at}.image`])) ?? t(`${S}.imageHint`)
                }
                image={item.image}
                altError={
                  item.image
                    ? problem(problems[`${at}.image`], PHOTO_COLLAGE_LIMITS.alt)
                    : undefined
                }
                onChange={(image) => {
                  setItem(index, { image }, "image")
                }}
              />
              <TextField
                id={PREVIEW_IDS.text(section.id, `${at}.caption`)}
                label={t(`${S}.caption`, { number })}
                value={item.caption}
                max={PHOTO_COLLAGE_LIMITS.caption}
                tokens
                error={problem(problems[`${at}.caption`], PHOTO_COLLAGE_LIMITS.caption)}
                onChange={(caption) => {
                  setItem(index, { caption }, "caption")
                }}
              />
              <LinkField
                id={PREVIEW_IDS.text(section.id, `${at}.link`)}
                label={t(`${S}.link`, { number })}
                term={t(`${S}.linkTerm`)}
                link={item.link}
                error={problem(problems[`${at}.link`], L.label)}
                onChange={(link) => {
                  setItem(index, { link }, "link")
                }}
              />
            </li>
          )
        })}
      </ol>
      <ListFooter
        label={t(`${S}.add`)}
        hint={t(`${S}.hint`, { min, max })}
        full={section.items.length >= max}
        onAdd={() => {
          setItems([...section.items, { image: null, caption: null, link: null }])
        }}
      />
    </div>
  )
}
