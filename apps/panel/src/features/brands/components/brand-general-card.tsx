import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateBrand } from "@/features/brands/api/brands"
import type { Brand } from "@/features/brands/api/brands"
import { useBrandPathPrefix } from "@/features/brands/use-brand-path"
import { errorText } from "@/lib/errors"

interface Values {
  name: string
  handle: string
  description: string
  is_active: boolean
}

/** The brand's name, page address, text and whether its page is live. */
export function BrandGeneralCard({ brand }: { brand: Brand }) {
  const { t } = useTranslation()
  const update = useUpdateBrand(brand.id)
  const prefix = useBrandPathPrefix()
  const saved: Values = {
    name: brand.name,
    handle: brand.handle,
    description: brand.description ?? "",
    is_active: brand.is_active,
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const submit = form.handleSubmit((values) => {
    const { dirtyFields } = form.formState
    update.mutate(
      {
        ...(dirtyFields.name ? { name: values.name } : {}),
        ...(dirtyFields.handle ? { handle: values.handle.trim() } : {}),
        ...(dirtyFields.description ? { description: values.description } : {}),
        ...(dirtyFields.is_active ? { is_active: values.is_active } : {}),
      },
      {
        onSuccess: () => toast.success(t("brands.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t("brands.general")}
      dirty={form.formState.isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved)
      }}
    >
      <Field label={t("brands.name")} htmlFor="brand-name" required>
        <Input id="brand-name" maxLength={120} {...form.register("name")} />
      </Field>
      <Field label={t("brands.handle")} htmlFor="brand-handle" hint={t("brands.handleHint")}>
        <div className="flex items-center rounded-md border">
          <span className="pl-3 font-mono text-[13px] text-muted-foreground">{prefix}</span>
          <Input
            id="brand-handle"
            spellCheck={false}
            className="border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
      <Field
        label={t("brands.descriptionLabel")}
        htmlFor="brand-description"
        hint={t("brands.descriptionHint")}
      >
        <Textarea id="brand-description" className="min-h-32" {...form.register("description")} />
      </Field>
      <Controller
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t("brands.activeLabel")}</span>
              <span className="text-[13px] text-muted-foreground">{t("brands.activeHint")}</span>
            </span>
          </label>
        )}
      />
    </CardForm>
  )
}
