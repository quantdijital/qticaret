import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Button } from "@/components/ui/button"
import { IMAGE_ACCEPT, uploadContentImage } from "@/features/content/editor/upload"
import { useSaveSection } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const S = "settings.seo.shareImage"

/**
 * The shop's share image (F12.10, docs/13 §8): what a link to a page with
 * no image of its own shows on WhatsApp, Instagram or X. An upload, kept
 * in the media library like a page's cover.
 */
export function ShareImageCard({ saved }: { saved: SeoSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<SeoSettings>("seo")
  const picker = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const initial = { image: saved.default_og_image ?? "" }
  const form = useForm({ values: initial, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "image" })
  const upload = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setUploading(true)
    try {
      form.setValue("image", await uploadContentImage(file), { shouldDirty: true })
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setUploading(false)
    }
  }
  const submit = form.handleSubmit((values) => {
    save.mutate(
      { default_og_image: values.image || null },
      {
        onSuccess: (result) => {
          form.reset({ image: result.values.default_og_image ?? "" }, FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${S}.title`)}
      description={t(`${S}.hint`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(initial, FULL_RESET)
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {url ? (
          <img
            src={url}
            alt=""
            className="aspect-[1.91/1] w-full rounded-md border object-cover sm:w-72"
          />
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-md border border-dashed px-4 text-center text-[13px] text-muted-foreground sm:w-72">
            {t(`${S}.none`)}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted-foreground">{t(`${S}.size`)}</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={picker}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              aria-label={t(`${S}.choose`)}
              onChange={(event) => {
                void upload(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => picker.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {t(url ? `${S}.replace` : `${S}.add`)}
            </Button>
            {url ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  form.setValue("image", "", { shouldDirty: true })
                }}
              >
                <Trash2 />
                {t(`${S}.remove`)}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </CardForm>
  )
}
