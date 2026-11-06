import { Link } from "@tanstack/react-router"
import { SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type {
  BrandsSection,
  CategoriesSection,
  CountedSection,
  FooterNewsletter,
  WordedSection,
} from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import type { Problem } from "@/features/storefront/layout/problems"
import { CountField, F, TextField } from "./fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { RecordListField } from "./record-fields"

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
      <CountField
        id={`${section.id}-limit`}
        label={t(`${F}.limit`)}
        hint={t(`${F}.limitHint`, { max })}
        value={section.limit}
        max={max}
        onChange={(limit) => {
          onChange({ ...section, limit }, "limit")
        }}
      />
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

/** The badges themselves are written under Storefront preferences; here only where they show. */
export function TrustBadgesForm() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[13px] text-muted-foreground">{t("storefront.editor.trustBadges.text")}</p>
      <Button asChild variant="outline" size="sm">
        <Link to="/storefront/preferences" search={{ part: "badges" }}>
          <SlidersHorizontal />
          {t("storefront.editor.trustBadges.link")}
        </Link>
      </Button>
    </div>
  )
}
