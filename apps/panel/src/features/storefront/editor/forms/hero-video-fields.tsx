import { useTranslation } from "react-i18next"
import { HERO_VIDEO_LIMITS } from "@qticaret/types"
import { NamedGroup } from "../named-group"
import { TextField } from "./fields"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import type { HeroFull } from "./hero-full-fields"
import { useProblemText } from "./problem-text"

const H = "storefront.editor.heroFull.video"

/**
 * The full image opening's "Video" group: a YouTube or Vimeo link (none:
 * no button) and the button's words (none: the theme's "Videoyu izle").
 * A link the storefront would not play is named before the save.
 */
export function HeroVideoFields({ section, problems, onChange }: SectionFormProps<HeroFull>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  return (
    <NamedGroup name="video">
      <TextField
        id={FIELD_IDS.content(section.id, "video_url")}
        label={t(`${H}.url.label`)}
        term={t(`${H}.url.term`)}
        value={section.video_url ?? null}
        max={HERO_VIDEO_LIMITS.url}
        placeholder={t(`${H}.url.placeholder`)}
        hint={t(`${H}.url.hint`)}
        error={problem(problems["video_url"])}
        onChange={(video_url) => {
          onChange({ ...section, video_url }, "video_url")
        }}
      />
      <TextField
        id={FIELD_IDS.content(section.id, "video_label")}
        label={t(`${H}.label.label`)}
        term={t(`${H}.label.term`)}
        value={section.video_label ?? null}
        max={HERO_VIDEO_LIMITS.label}
        placeholder={t(`${H}.label.placeholder`)}
        hint={t(`${H}.label.hint`)}
        error={problem(problems["video_label"], HERO_VIDEO_LIMITS.label)}
        onChange={(video_label) => {
          onChange({ ...section, video_label }, "video_label")
        }}
      />
    </NamedGroup>
  )
}
