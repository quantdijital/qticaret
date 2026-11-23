import { useTranslation } from "react-i18next"
import { POSTS_INTRO_LIMITS } from "@qticaret/types"
import type { PostsSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { LinkField } from "./link-field"
import { PREVIEW_IDS } from "./preview-fields"
import { useProblemText } from "./problem-text"

const P = "storefront.editor.posts"

/**
 * The posts' intro panel's own words (adr/0077 Ek, "Tanıtım paneli"): an
 * upper line above the heading, a short intro under it and the panel's
 * button (none: the storefront's "every post"), all optional; under the
 * title and the count, which every variant shares.
 */
export function PostsIntroFields({ section, problems, onChange }: SectionFormProps<PostsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <>
      <TextField
        id={PREVIEW_IDS.text(section.id, "eyebrow")}
        label={t(`${F}.eyebrow`)}
        value={section.eyebrow ?? null}
        max={POSTS_INTRO_LIMITS.eyebrow}
        tokens
        placeholder={t(`${P}.eyebrowPlaceholder`)}
        error={problem(problems["eyebrow"], POSTS_INTRO_LIMITS.eyebrow)}
        onChange={(eyebrow) => {
          onChange({ ...section, eyebrow }, "eyebrow")
        }}
      />
      <TextField
        id={PREVIEW_IDS.text(section.id, "intro")}
        label={t(`${P}.intro`)}
        value={section.intro ?? null}
        max={POSTS_INTRO_LIMITS.intro}
        tokens
        multiline
        error={problem(problems["intro"], POSTS_INTRO_LIMITS.intro)}
        onChange={(intro) => {
          onChange({ ...section, intro }, "intro")
        }}
      />
      <LinkField
        id={PREVIEW_IDS.text(section.id, "link")}
        label={t(`${P}.link`)}
        term={t(`${P}.linkTerm`)}
        hint={t(`${P}.linkHint`)}
        link={section.link ?? null}
        error={problem(problems["link"], L.label)}
        onChange={(link, field) => {
          onChange({ ...section, link }, field && "link.label")
        }}
      />
    </>
  )
}
