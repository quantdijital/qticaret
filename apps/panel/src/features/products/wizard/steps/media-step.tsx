import { useFieldArray, useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { ImageUploader, MAX_IMAGES } from "@/features/products/components/image-uploader"
import type { WizardValues } from "../schema"

/** Step 2: the product's pictures; the first one is its main picture. */
export function MediaStep() {
  const { t } = useTranslation()
  const { control } = useFormContext<WizardValues>()
  const images = useFieldArray({ control, name: "images", keyName: "fieldKey" })
  return (
    <SectionCard
      title={t("products.media.card")}
      description={t("products.media.hint", { max: MAX_IMAGES })}
    >
      <ImageUploader
        images={images.fields.map((image) => ({ key: image.fieldKey, url: image.url }))}
        onAdd={(stored) => {
          images.append(stored)
        }}
        onRemove={(index) => {
          images.remove(index)
        }}
        onMakeMain={(index) => {
          images.move(index, 0)
        }}
      />
      {images.fields.length === 0 ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("products.media.optional")}
        </p>
      ) : null}
    </SectionCard>
  )
}
