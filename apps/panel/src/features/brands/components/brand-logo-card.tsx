import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { useUpdateBrand } from "@/features/brands/api/brands"
import type { Brand } from "@/features/brands/api/brands"
import { BrandLogo } from "@/features/brands/components/brand-logo"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"

/** The brand's logo: uploaded through the checked upload route (F2.9b), saved at once. */
export function BrandLogoCard({ brand }: { brand: Brand }) {
  const { t } = useTranslation()
  const update = useUpdateBrand(brand.id)
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const busy = uploading || update.isPending

  const save = (logoFileId: string | null) => {
    update.mutate(
      { logo_file_id: logoFileId },
      {
        onSuccess: () => toast.success(t(logoFileId ? "brands.logoSaved" : "brands.logoRemoved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const { files } = await sdk.admin.upload.create({ files: [file] })
      const stored = files[0]
      if (stored) {
        save(stored.id)
      }
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setUploading(false)
    }
  }

  return (
    <SectionCard title={t("brands.logo")} description={t("brands.logoHint")}>
      <div className="flex items-center gap-4">
        <BrandLogo url={brand.logo_url} name={brand.name} className="size-20" />
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) {
                void upload(file)
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {t(brand.logo_url ? "brands.logoChange" : "brands.logoUpload")}
          </Button>
          {brand.logo_url ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-destructive-text"
              onClick={() => {
                save(null)
              }}
            >
              <Trash2 />
              {t("brands.logoRemove")}
            </Button>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}
