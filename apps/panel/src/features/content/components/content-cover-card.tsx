import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { MediaField } from "@/components/patterns/media-field"
import { Input } from "@/components/ui/input"
import { useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

interface Values {
  image_url: string
  image_alt: string
}

const valuesOf = (entry: ContentDetail): Values => ({
  image_url: entry.image_url ?? "",
  image_alt: entry.image_alt ?? "",
})

/** The cover: the list's and the share card's image, with its alt text (docs/13 §8). */
export function ContentCoverCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const saved = valuesOf(entry)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const url = useWatch({ control: form.control, name: "image_url" })
  const submit = form.handleSubmit((values) => {
    update.mutate(
      { image_url: values.image_url || null, image_alt: values.image_alt.trim() || null },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.entry), FULL_RESET)
          toast.success(t("content.saved"))
        },
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
      <MediaField
        id="content-cover"
        label={t("content.cover")}
        value={url || null}
        frame="share"
        hideLabel
        emptyText={t("content.noCover")}
        onChange={(asset) => {
          form.setValue("image_url", asset?.url ?? "", { shouldDirty: true })
          // A library image's own alt text fills an empty one
          if (asset?.alt && !form.getValues("image_alt").trim()) {
            form.setValue("image_alt", asset.alt, { shouldDirty: true })
          }
        }}
      >
        <Field
          label={t("content.fields.coverAlt")}
          htmlFor="content-cover-alt"
          hint={t("content.coverAltHint")}
        >
          <Input id="content-cover-alt" maxLength={300} {...form.register("image_alt")} />
        </Field>
      </MediaField>
    </CardForm>
  )
}
