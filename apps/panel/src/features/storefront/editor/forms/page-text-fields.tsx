import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { contactSwitchOf, pageTextSwitchOf } from "@qticaret/types"
import type {
  ContactSection,
  FactsSection,
  RichTextSection,
} from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { DocField } from "./doc-field"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import { PREVIEW_IDS } from "./preview-fields"

const P = "storefront.editor.pageText"

/**
 * "Sayfa metni"'s two switches (adr/0073 Ek 2026-11-19 (2) K2): the outline
 * beside a long text and a questions-and-answers text read as grouped
 * questions, both on (`auto`) as the page drew them before.
 */
export function PageTextSwitches({
  section,
  onChange,
}: Pick<SectionFormProps<RichTextSection>, "section" | "onChange">) {
  const { t } = useTranslation()
  const outline = pageTextSwitchOf(section.outline) === "auto"
  const questions = pageTextSwitchOf(section.questions) === "auto"
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow
        id={FIELD_IDS.content(section.id, "outline")}
        label={t(`${P}.outline`)}
        hint={t(`${P}.outlineHint`)}
        checked={outline}
        onChange={(on) => {
          onChange({ ...section, outline: on ? "auto" : "off" }, "outline")
        }}
      />
      <SwitchRow
        id={FIELD_IDS.content(section.id, "questions")}
        label={t(`${P}.questions`)}
        hint={t(`${P}.questionsHint`)}
        checked={questions}
        onChange={(on) => {
          onChange({ ...section, questions: on ? "auto" : "off" }, "questions")
        }}
      />
    </div>
  )
}

/**
 * The contact page's body (K2): its own text beside the form, the form and
 * the shop's imprint each shown or not. The ways to reach the shop and the
 * imprint come from the store profile.
 */
export function ContactForm({ section, onChange }: SectionFormProps<ContactSection>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-5">
      <DocField
        id={PREVIEW_IDS.text(section.id, "body")}
        label={t(`${P}.contactBody`)}
        body={section.body}
        onChange={(body) => {
          onChange({ ...section, body }, "body")
        }}
      />
      <SwitchRow
        id={FIELD_IDS.content(section.id, "form")}
        label={t(`${P}.form`)}
        hint={t(`${P}.formHint`)}
        checked={contactSwitchOf(section.form) === "on"}
        onChange={(on) => {
          onChange({ ...section, form: on ? "on" : "off" }, "form")
        }}
      />
      <SwitchRow
        id={FIELD_IDS.content(section.id, "imprint")}
        label={t(`${P}.imprint`)}
        hint={t(`${P}.imprintHint`)}
        checked={contactSwitchOf(section.imprint) === "on"}
        onChange={(on) => {
          onChange({ ...section, imprint: on ? "on" : "off" }, "imprint")
        }}
      />
      <Link
        to="/settings/store"
        className="text-xs text-primary-text underline-offset-4 hover:underline"
      >
        {t(`${P}.storeProfile`)}
      </Link>
    </div>
  )
}

/** The payment or shipping facts (K2): live, nothing to write here; where they come from. */
export function FactsNote({ section }: { section: FactsSection }) {
  const { t } = useTranslation()
  return (
    <p className="text-[13px] leading-5 text-muted-foreground">{t(`${P}.facts.${section.type}`)}</p>
  )
}
