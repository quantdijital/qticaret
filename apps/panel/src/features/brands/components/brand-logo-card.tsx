import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { MediaField } from "@/components/patterns/media-field"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { useUpdateBrand } from "@/features/brands/api/brands"
import type { Brand } from "@/features/brands/api/brands"
import { errorText } from "@/lib/errors"

/**
 * The brand's logo: chosen from the media library (uploaded there through
 * the checked upload route, F2.9b, or brought in from an address), saved
 * at once. The brand keeps the file's storage key.
 */
export function BrandLogoCard({ brand }: { brand: Brand }) {
  const { t } = useTranslation()
  const update = useUpdateBrand(brand.id)

  const save = (logoFileId: string | null) => {
    update.mutate(
      { logo_file_id: logoFileId },
      {
        onSuccess: () => toast.success(t(logoFileId ? "brands.logoSaved" : "brands.logoRemoved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <SectionCard title={t("brands.logo")} description={t("brands.logoHint")}>
      <MediaField
        id="brand-logo"
        label={t("brands.logo")}
        value={brand.logo_url}
        frame="square"
        inline
        hideLabel
        busy={update.isPending}
        emptyText={t("brands.noLogo")}
        onChange={(asset) => {
          if (asset && !asset.file_id) {
            return
          }
          save(asset?.file_id ?? null)
        }}
      />
    </SectionCard>
  )
}
