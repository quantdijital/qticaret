import { useTranslation } from "react-i18next"
import { ListFooter, RowActions } from "@/features/settings/components/storefront-rows"
import { STEPS_LIMITS } from "@qticaret/types"
import type { StepsItem, StepsSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { LinkField } from "./link-field"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const S = "storefront.editor.steps"

/**
 * The numbered steps' content (adr/0077 §10): the title (empty, the
 * storefront's own words), a short intro, three to six steps in order,
 * each a title and an optional line (the theme numbers them), and one
 * optional link under them. How they stand and are numbered is in
 * "Diziliş" (`PointsGroups`), their ground and alignment in "Görünüm".
 */
export function StepsForm({ section, problems, onChange }: SectionFormProps<StepsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const { min, max } = STEPS_LIMITS.items
  const setItems = (items: StepsItem[], field?: string) => {
    onChange({ ...section, items }, field)
  }
  const setItem = (index: number, next: Partial<StepsItem>, field: keyof StepsItem) => {
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
        placeholder={t("storefront.editor.defaults.steps")}
        hint={t(`${F}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "intro")}
        label={t(`${S}.intro`)}
        value={section.intro}
        max={STEPS_LIMITS.intro}
        tokens
        multiline
        error={problem(problems["intro"], STEPS_LIMITS.intro)}
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
              <TextField
                id={PREVIEW_IDS.text(section.id, `${at}.title`)}
                label={t(`${S}.title`, { number })}
                value={item.title}
                max={STEPS_LIMITS.title}
                tokens
                required
                error={problem(problems[`${at}.title`], STEPS_LIMITS.title)}
                onChange={(title) => {
                  setItem(index, { title: title ?? "" }, "title")
                }}
              />
              <TextField
                id={PREVIEW_IDS.text(section.id, `${at}.text`)}
                label={t(`${S}.text`, { number })}
                value={item.text}
                max={STEPS_LIMITS.text}
                tokens
                multiline
                error={problem(problems[`${at}.text`], STEPS_LIMITS.text)}
                onChange={(text) => {
                  setItem(index, { text }, "text")
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
          setItems([...section.items, { title: "", text: null }])
        }}
      />
      <LinkField
        id={PREVIEW_IDS.text(section.id, "link")}
        label={t(`${S}.link`)}
        term={t(`${S}.linkTerm`)}
        hint={t(`${S}.linkHint`)}
        link={section.link}
        error={problem(problems["link"], L.label)}
        onChange={(link, field) => {
          onChange({ ...section, link }, field && "link.label")
        }}
      />
    </div>
  )
}
