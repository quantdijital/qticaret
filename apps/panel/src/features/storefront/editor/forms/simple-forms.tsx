import { useTranslation } from "react-i18next"
import type {
  BrandsSection,
  CategoriesSection,
  CountedSection,
  FooterNewsletter,
  WordedSection,
} from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { Problem } from "@/features/storefront/layout/problems"
import { CategoryCardsFields } from "./category-cards-fields"
import { CategoryCollageFields } from "./category-collage-fields"
import { FIELD_IDS } from "./field-registry"
import { CountField, F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { LinkField } from "./link-field"
import { PREVIEW_IDS } from "./preview-fields"
import { RecordListField } from "./record-fields"
import { SwitchRow } from "../theme-fields"

const D = "storefront.editor.defaults"
const R = "storefront.editor.records"

interface TitleFieldProps {
  id: string
  title: string | null
  /** The storefront's own title, shown while none is written. */
  placeholder: string
  problem: Problem | undefined
  onChange: (title: string | null) => void
}

/** A section's own title; empty, the storefront's words. */
export function TitleField({ id, title, placeholder, problem, onChange }: TitleFieldProps) {
  const { t } = useTranslation()
  const text = useProblemText()
  return (
    <TextField
      id={`${id}-title`}
      label={t(`${F}.title`)}
      term={t(`${F}.titleTerm`)}
      value={title}
      max={L.title}
      placeholder={placeholder}
      hint={t(`${F}.titleHint`)}
      error={text(problem, L.title)}
      onChange={onChange}
    />
  )
}

/** Categories the shop picks; none, its top categories. */
export function CategoriesForm({
  section,
  problems,
  onChange,
}: SectionFormProps<CategoriesSection>) {
  const { t } = useTranslation()
  const text = useProblemText()
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t(`${D}.categories`)}
        problem={problems["title"]}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <RecordListField
        kind="category"
        label={t(`${R}.categories`)}
        ids={section.category_ids}
        empty={t(`${R}.categoriesEmpty`)}
        onChange={(category_ids) => {
          onChange({ ...section, category_ids })
        }}
      />
      {section.variant === "linked" ? (
        <CategoryCardsFields section={section} onChange={onChange} />
      ) : section.variant === "collage" ? (
        <CategoryCollageFields section={section} onChange={onChange} />
      ) : null}
      <div id={FIELD_IDS.content(section.id, "show_count")}>
        <SwitchRow
          id={`${section.id}-show-count`}
          label={t("storefront.editor.categories.showCount")}
          term={t("storefront.editor.categories.showCountTerm")}
          hint={t("storefront.editor.categories.showCountHint")}
          checked={section.show_count}
          onChange={(show_count) => {
            onChange({ ...section, show_count })
          }}
        />
      </div>
      <LinkField
        id={PREVIEW_IDS.text(section.id, "more")}
        label={t("storefront.editor.categories.more")}
        term={t("storefront.editor.categories.moreTerm")}
        hint={t("storefront.editor.categories.moreHint")}
        link={section.more}
        error={text(problems["more"], L.label)}
        onChange={(more, field) => {
          onChange({ ...section, more }, field && "more.label")
        }}
      />
    </div>
  )
}

/** Brands the shop picks; none, every brand. */
export function BrandsForm({ section, problems, onChange }: SectionFormProps<BrandsSection>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t(`${D}.brands`)}
        problem={problems["title"]}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <RecordListField
        kind="brand"
        label={t(`${R}.brands`)}
        ids={section.brand_ids}
        empty={t(`${R}.brandsEmpty`)}
        onChange={(brand_ids) => {
          onChange({ ...section, brand_ids })
        }}
      />
    </div>
  )
}

/** The latest blog posts or customer reviews: a title and how many. */
export function CountedForm({ section, problems, onChange }: SectionFormProps<CountedSection>) {
  const { t } = useTranslation()
  const max = section.type === "posts" ? L.posts : L.reviews
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t(`${D}.${section.type}`)}
        problem={problems["title"]}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <div id={FIELD_IDS.content(section.id, "limit")}>
        <CountField
          id={`${section.id}-limit`}
          label={t(`${F}.limit`)}
          term={t(`${F}.limitTerm`)}
          hint={t(`${F}.limitHint`, { max })}
          value={section.limit}
          max={max}
          onChange={(limit) => {
            onChange({ ...section, limit }, "limit")
          }}
        />
      </div>
    </div>
  )
}

type Worded = WordedSection | FooterNewsletter

/** A newsletter box or a call for help: a title and a sentence, the storefront's own when empty. */
export function WordedForm<T extends Worded>({ section, problems, onChange }: SectionFormProps<T>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const help = section.type === "help"
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t(`${D}.${section.type}`)}
        problem={problems["title"]}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <TextField
        id={`${section.id}-text`}
        label={t(`${F}.text`)}
        value={section.text}
        max={L.text}
        tokens
        multiline
        placeholder={t(help ? `${D}.helpText` : `${D}.newsletterText`)}
        hint={t(`${F}.textHint`)}
        error={problem(problems["text"], L.text)}
        onChange={(text) => {
          onChange({ ...section, text }, "text")
        }}
      />
      {help ? (
        <p className="text-xs text-muted-foreground">{t("storefront.editor.help.contact")}</p>
      ) : null}
    </div>
  )
}
