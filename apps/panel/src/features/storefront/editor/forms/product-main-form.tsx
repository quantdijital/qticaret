import { useTranslation } from "react-i18next"
import { PRODUCT_IMAGE_RATIOS, productImageRatioOf } from "@qticaret/types"
import type { ProductMainSection } from "@/features/storefront/api/layout-main"
import type { SectionFormProps } from "./form-props"
import { StepChoice } from "./step-choice"

const P = "storefront.editor.productMain"

/**
 * The product's own block: the gallery's picture shape (square, the
 * default and the page as before; landscape 4:3; portrait 3:4). The square
 * leaves no field behind, so a block left alone saves as before.
 */
export function ProductMainForm({ section, onChange }: SectionFormProps<ProductMainSection>) {
  const { t } = useTranslation()
  return (
    <StepChoice
      id={`${section.id}-image-ratio`}
      label={t(`${P}.image_ratio.label`)}
      term={t(`${P}.image_ratio.term`)}
      hint={t(`${P}.image_ratio.hint`)}
      steps={PRODUCT_IMAGE_RATIOS}
      value={productImageRatioOf(section.image_ratio)}
      fallback="square"
      nameOf={(step) => t(`${P}.image_ratio.${step}`)}
      onChange={(step) => {
        const next: ProductMainSection = { ...section, image_ratio: step }
        if (step === "square") {
          delete next.image_ratio
        }
        onChange(next)
      }}
    />
  )
}
