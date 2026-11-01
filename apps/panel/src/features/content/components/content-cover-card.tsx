import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { IMAGE_ACCEPT, uploadContentImage } from "@/features/content/editor/upload"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

interface Values {
  image_url: string
  image_alt: string
}

/** The cover: the list's and the share card's image, with its alt text (docs/13 §8). */
export function ContentCoverCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const picker = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const saved: Values = { image_url: entry.image_url ?? "", image_alt: entry.image_alt ?? "" }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "image_url" })
  const upload = async (file: File | undefined) => {
    if (!file) {
      return
    }
    setUploading(true)
    try {
      form.setValue("image_url", await uploadContentImage(file), { shouldDirty: true })
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setUploading(false)
    }
  }
  const submit = form.handleSubmit((values) => {
    update.mutate(
      { image_url: values.image_url || null, image_alt: values.image_alt.trim() || null },
      {
        onSuccess: () => toast.success(t("content.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t("content.cover")}
      description={t("content.coverHint")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      {url ? (
        <img src={url} alt="" className="aspect-[1.91/1] w-full rounded-md border object-cover" />
      ) : (
        <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-md border border-dashed text-[13px] text-muted-foreground">
          {t("content.noCover")}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={picker}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
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
          {t(url ? "content.replaceCover" : "content.addCover")}
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              form.setValue("image_url", "", { shouldDirty: true })
            }}
          >
            <Trash2 />
            {t("content.removeCover")}
          </Button>
        ) : null}
      </div>
      {url ? (
        <Field
          label={t("content.fields.coverAlt")}
          htmlFor="content-cover-alt"
          hint={t("content.coverAltHint")}
        >
          <Input id="content-cover-alt" maxLength={300} {...form.register("image_alt")} />
        </Field>
      ) : null}
    </CardForm>
  )
}
