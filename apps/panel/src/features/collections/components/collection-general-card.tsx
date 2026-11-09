import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  useSetCollectionDetails,
  useUpdateCollection,
} from "@/features/collections/api/collections"
import type { Collection } from "@/features/collections/api/collections"
import { COLLECTION_PATH_PREFIX } from "@/features/collections/paths"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { isValidSlug } from "@/lib/slug"

const C = "collections"

interface Values {
  title: string
  handle: string
  description: string
  is_active: boolean
}

const valuesOf = (collection: Collection): Values => ({
  title: collection.title,
  handle: collection.handle,
  description: collection.description ?? "",
  is_active: collection.is_active,
})

/**
 * The collection's name, page address, intro and whether its page is
 * public. Name and address are Medusa's fields, the rest ours: one save
 * sends each what changed.
 */
export function CollectionGeneralCard({ collection }: { collection: Collection }) {
  const { t } = useTranslation()
  const update = useUpdateCollection(collection.id)
  const details = useSetCollectionDetails(collection.id)
  const saved = valuesOf(collection)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const { errors } = form.formState

  const submit = form.handleSubmit(async (values) => {
    const { dirtyFields } = form.formState
    try {
      if (dirtyFields.title || dirtyFields.handle) {
        await update.mutateAsync({
          ...(dirtyFields.title ? { title: values.title.trim() } : {}),
          ...(dirtyFields.handle ? { handle: values.handle.trim() } : {}),
        })
      }
      if (dirtyFields.description || dirtyFields.is_active) {
        await details.mutateAsync({
          ...(dirtyFields.description ? { description: values.description } : {}),
          ...(dirtyFields.is_active ? { is_active: values.is_active } : {}),
        })
      }
      form.reset(values, FULL_RESET)
      toast.success(t(`${C}.saved`))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      title={t(`${C}.general`)}
      dirty={form.formState.isDirty}
      saving={update.isPending || details.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field
        label={t(`${C}.name`)}
        htmlFor="collection-title"
        required
        error={errors.title ? t(`${C}.nameRequired`) : undefined}
      >
        <Input
          id="collection-title"
          maxLength={200}
          {...form.register("title", { validate: (text) => text.trim().length > 0 })}
        />
      </Field>
      <Field
        label={t(`${C}.handle`)}
        htmlFor="collection-handle"
        hint={t(`${C}.handleHint`)}
        error={errors.handle ? t("products.errors.handle") : undefined}
      >
        <div className="flex items-center rounded-md border">
          <span className="pl-3 font-mono text-[13px] text-muted-foreground">
            {COLLECTION_PATH_PREFIX}
          </span>
          <Input
            id="collection-handle"
            spellCheck={false}
            className="border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle", { validate: (text) => isValidSlug(text.trim()) })}
          />
        </div>
      </Field>
      <Field
        label={t(`${C}.descriptionLabel`)}
        htmlFor="collection-description"
        hint={t(`${C}.descriptionHint`)}
      >
        <Textarea
          id="collection-description"
          className="min-h-32"
          maxLength={20_000}
          {...form.register("description")}
        />
      </Field>
      <Controller
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`${C}.activeLabel`)}</span>
              <span className="text-[13px] text-muted-foreground">{t(`${C}.activeHint`)}</span>
            </span>
          </label>
        )}
      />
    </CardForm>
  )
}
