import { useTranslation } from "react-i18next"
import {
  RICH_TEXT_IMAGE_SIDES,
  RICH_TEXT_IMAGE_SIDE_DEFAULT,
  richTextImageSideOf,
} from "@qticaret/types"
import type { RichTextSection } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { FIELD_IDS } from "./field-registry"
import type { SectionFormProps } from "./form-props"
import { ImageField } from "./image-field"
import { useProblemText } from "./problem-text"
import { PREVIEW_IDS } from "./preview-fields"
import { StepChoice } from "./step-choice"

const T = "storefront.editor.richText"

/**
 * "Görselli metin"'s own fields (adr/0073 §3), under the title while the
 * variant is chosen: the picture (the media library's, the draft waits
 * for one; replaced, never taken off) and the side it stands on from
 * 1024 px. On a phone it is on top whatever the side.
 */
export function RichTextPicture({
  section,
  problems,
  onChange,
}: SectionFormProps<RichTextSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const missing = problems["image"] === "imageRequired"
  return (
    <>
      <div className="flex flex-col gap-2">
        <ImageField
          id={PREVIEW_IDS.text(section.id, "image")}
          label={t(`${T}.image`)}
          hint={t(`${T}.imageHint`)}
          image={section.image ?? null}
          removable={false}
          altError={missing ? undefined : problem(problems["image"], L.alt)}
          onChange={(image) => {
            onChange({ ...section, image }, "image")
          }}
        />
        {missing ? (
          <p role="alert" className="text-xs text-destructive-text">
            {problem("imageRequired")}
          </p>
        ) : null}
      </div>
      <StepChoice
        id={FIELD_IDS.content(section.id, "image_side")}
        label={t(`${T}.imageSide`)}
        term={t(`${T}.imageSideTerm`)}
        hint={t(`${T}.imageSideHint`)}
        steps={RICH_TEXT_IMAGE_SIDES}
        value={richTextImageSideOf(section.image_side)}
        fallback={RICH_TEXT_IMAGE_SIDE_DEFAULT}
        nameOf={(side) => t(`${T}.imageSides.${side}`)}
        onChange={(image_side) => {
          onChange({ ...section, image_side }, "image_side")
        }}
      />
    </>
  )
}
