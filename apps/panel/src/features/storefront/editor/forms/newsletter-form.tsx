import { useTranslation } from "react-i18next"
import { NEWSLETTER_LIMITS, newsletterHasNote } from "@qticaret/types"
import type { FooterNewsletter, NewsletterSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import { TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { ImageField } from "./image-field"
import { useProblemText } from "./problem-text"
import { PREVIEW_IDS } from "./preview-fields"
import { TitleField } from "./simple-forms"

const N = "storefront.editor.newsletter"
const D = "storefront.editor.defaults"

type Newsletter = NewsletterSection | FooterNewsletter

/**
 * The newsletter box's words (adr/0049 Ek 2026-11-17 e-bülten), on a page
 * or in the footer: its heading; on the new variants the line under it,
 * on the split band and the picture card the promise line (shown unless
 * switched off) and on the card its picture; then the consent sentence
 * (`text`, the box's label, İYS), named for what it is. Each empty field
 * the storefront's own words.
 */
export function NewsletterForm<T extends Newsletter>({
  section,
  problems,
  onChange,
}: SectionFormProps<T>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (patch: Partial<Newsletter>, field: string) => {
    onChange({ ...section, ...patch }, field)
  }
  const plain = section.variant === "standard"
  const promise = newsletterHasNote(section.variant)
  return (
    <div className="flex flex-col gap-5">
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t(`${D}.newsletter`)}
        problem={problems["title"]}
        onChange={(title) => {
          set({ title }, "title")
        }}
      />
      {plain ? null : (
        <TextField
          id={PREVIEW_IDS.text(section.id, "description")}
          label={t(`${N}.description`)}
          term={t(`${N}.descriptionTerm`)}
          value={section.description}
          max={NEWSLETTER_LIMITS.description}
          tokens
          multiline
          placeholder={t(`${N}.descriptionPlaceholder`)}
          hint={t(`${N}.descriptionHint`)}
          error={problem(problems["description"], NEWSLETTER_LIMITS.description)}
          onChange={(description) => {
            set({ description }, "description")
          }}
        />
      )}
      {promise ? (
        <div id={FIELD_IDS.content(section.id, "show_note")} className="flex flex-col gap-3">
          <SwitchRow
            id={`${section.id}-show-note`}
            label={t(`${N}.showNote`)}
            term={t(`${N}.showNoteTerm`)}
            hint={t(`${N}.showNoteHint`)}
            checked={section.show_note !== false}
            onChange={(show_note) => {
              set({ show_note }, "show_note")
            }}
          />
          {section.show_note === false ? null : (
            <TextField
              id={PREVIEW_IDS.text(section.id, "note")}
              label={t(`${N}.note`)}
              value={section.note ?? null}
              max={NEWSLETTER_LIMITS.note}
              tokens
              placeholder={t(`${N}.notePlaceholder`)}
              hint={t(`${N}.noteHint`)}
              error={problem(problems["note"], NEWSLETTER_LIMITS.note)}
              onChange={(note) => {
                set({ note }, "note")
              }}
            />
          )}
        </div>
      ) : null}
      {section.variant === "image_card" ? (
        <ImageField
          id={PREVIEW_IDS.text(section.id, "image")}
          label={t(`${N}.image`)}
          hint={t(`${N}.imageHint`)}
          image={section.image ?? null}
          altError={problem(problems["image.alt"], L.alt)}
          onChange={(image) => {
            set({ image }, "image")
          }}
        />
      ) : null}
      <TextField
        id={`${section.id}-text`}
        label={t(`${N}.consent`)}
        term={t(`${N}.consentTerm`)}
        value={section.text}
        max={L.text}
        tokens
        multiline
        placeholder={t(`${D}.newsletterText`)}
        hint={t(`${N}.consentHint`)}
        error={problem(problems["text"], L.text)}
        onChange={(text) => {
          set({ text }, "text")
        }}
      />
    </div>
  )
}
