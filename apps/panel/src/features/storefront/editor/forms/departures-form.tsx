import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { DEPARTURES_LIMITS } from "@qticaret/types"
import type { DeparturesSource } from "@qticaret/types"
import type { DeparturesSection } from "@/features/storefront/api/layout"
import { CountField, F, TextField } from "./fields"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"
import { RecordField } from "./record-fields"
import { TitleField } from "./simple-forms"
import { HeadLinesFields } from "./head-lines-fields"

const S = "storefront.editor.departures"

const KINDS: readonly DeparturesSource["kind"][] = ["all", "category", "collection"]

/** A source of another kind, nothing chosen in it yet. */
const sourceOf = (kind: DeparturesSource["kind"]): DeparturesSource =>
  kind === "category"
    ? { kind, category_id: "" }
    : kind === "collection"
      ? { kind, collection_id: "" }
      : { kind: "all" }

/**
 * Upcoming departures' content (adr/0077 §10): the title (empty, the
 * storefront's own words), a short intro, whose departures (every dated
 * product's, a category's or a collection's) and how many. The list or
 * the cards are in "Diziliş" (`DeparturesGroups`), the ground and
 * alignment in "Görünüm". The rows are the shop's live departures.
 */
export function DeparturesForm({
  section,
  problems,
  onChange,
}: SectionFormProps<DeparturesSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const { source } = section
  const { min, max } = DEPARTURES_LIMITS.limit
  const setSource = (next: DeparturesSource) => {
    onChange({ ...section, source: next }, "source")
  }
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t("storefront.editor.defaults.departures")}
        problem={problems["title"]}
        onChange={(title) => {
          onChange({ ...section, title }, "title")
        }}
      />
      <HeadLinesFields
        section={section}
        sectionId={section.id}
        problems={problems}
        onChange={onChange}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "intro")}
        label={t(`${S}.intro`)}
        value={section.intro}
        max={DEPARTURES_LIMITS.intro}
        tokens
        multiline
        error={problem(problems["intro"], DEPARTURES_LIMITS.intro)}
        onChange={(intro) => {
          onChange({ ...section, intro }, "intro")
        }}
      />
      <Field label={t(`${S}.source`)} term={t(`${S}.sourceTerm`)} hint={t(`${S}.sourceHint`)}>
        <RadioGroup
          aria-label={t(`${S}.source`)}
          value={source.kind}
          className="gap-2"
          onValueChange={(kind) => {
            if (kind !== source.kind) {
              setSource(sourceOf(kind as DeparturesSource["kind"]))
            }
          }}
        >
          {KINDS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm">
              <RadioGroupItem value={kind} />
              {t(`${S}.sources.${kind}`)}
            </label>
          ))}
        </RadioGroup>
      </Field>
      {source.kind === "category" ? (
        <RecordField
          kind="category"
          label={t("storefront.editor.products.category")}
          id={source.category_id}
          error={problem(problems["source"])}
          onChange={(category_id) => {
            setSource({ kind: "category", category_id })
          }}
        />
      ) : source.kind === "collection" ? (
        <RecordField
          kind="collection"
          label={t("storefront.editor.products.collection")}
          id={source.collection_id}
          error={problem(problems["source"])}
          onChange={(collection_id) => {
            setSource({ kind: "collection", collection_id })
          }}
        />
      ) : null}
      <div id={FIELD_IDS.content(section.id, "limit")}>
        <CountField
          id={`${section.id}-limit`}
          label={t(`${F}.limit`)}
          term={t(`${S}.limitTerm`)}
          hint={t(`${S}.limitHint`, { min, max })}
          value={section.limit}
          min={min}
          max={max}
          onChange={(limit) => {
            onChange({ ...section, limit }, "limit")
          }}
        />
      </div>
    </div>
  )
}
