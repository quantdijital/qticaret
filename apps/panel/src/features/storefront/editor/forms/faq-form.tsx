import { useTranslation } from "react-i18next"
import { ListFooter, RowActions } from "@/features/settings/components/storefront-rows"
import type { FaqItem, FaqSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"

const Q = "storefront.editor.faq"

/**
 * Questions and their answers, in order (adr/0049 ek 2026-11-03). An
 * answer may hold the shop's details. Both are plain text; the storefront
 * shows them and writes no `FAQPage` data (docs/13 §5).
 */
export function FaqForm({ section, problems, onChange }: SectionFormProps<FaqSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const setItems = (items: FaqItem[], field?: string) => {
    onChange({ ...section, items }, field)
  }
  const setItem = (index: number, next: Partial<FaqItem>, field: keyof FaqItem) => {
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
        value={section.title}
        max={L.title}
        placeholder={t("storefront.editor.defaults.faq")}
        hint={t(`${F}.titleHint`)}
        error={problem(problems["title"], L.title)}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <ol aria-label={t(`${Q}.items`)} className="flex flex-col gap-3">
        {section.items.map((item, index) => {
          const number = index + 1
          const at = `items.${String(index)}`
          const name = t(`${Q}.item`, { number })
          return (
            <li key={index} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{name}</span>
                <RowActions
                  index={index}
                  count={section.items.length}
                  item={name}
                  removable={section.items.length > 1}
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
                id={`${section.id}-${at}-question`}
                label={t(`${Q}.question`, { number })}
                value={item.question}
                max={L.question}
                required
                error={problem(problems[`${at}.question`], L.question)}
                onChange={(question) => {
                  setItem(index, { question: question ?? "" }, "question")
                }}
              />
              <TextField
                id={`${section.id}-${at}-answer`}
                label={t(`${Q}.answer`, { number })}
                value={item.answer}
                max={L.answer}
                tokens
                multiline
                required
                error={problem(problems[`${at}.answer`], L.answer)}
                onChange={(answer) => {
                  setItem(index, { answer: answer ?? "" }, "answer")
                }}
              />
            </li>
          )
        })}
      </ol>
      <ListFooter
        label={t(`${Q}.add`)}
        hint={t(`${Q}.hint`, { max: L.faq })}
        full={section.items.length >= L.faq}
        onAdd={() => {
          setItems([...section.items, { question: "", answer: "" }])
        }}
      />
    </div>
  )
}
