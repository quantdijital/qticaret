import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { SUGGESTED_WORDS, wordCount } from "@/features/products/wizard/readiness"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { isValidSlug } from "@/lib/slug"
import { CardForm } from "@/components/patterns/card-form"

const schema = z.object({
  title: z.string().trim().min(2, { message: "products.errors.title" }).max(200),
  handle: z.string().trim().refine(isValidSlug, { message: "products.errors.handle" }),
  description: z.string().max(20_000),
})
type Values = z.infer<typeof schema>

/** Name, address and story; the address change keeps the old one reserved (F3.1). */
export function GeneralCard({
  product,
  className,
}: {
  product: ProductDetail
  className?: string
}) {
  const { t } = useTranslation()
  const update = useUpdateProduct(product.id)
  const prefix = useProductPathPrefix()
  const saved: Values = {
    title: product.title,
    handle: product.handle,
    description: product.description ?? "",
  }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    // A save elsewhere on the page reloads the product; edits here stay
    resetOptions: { keepDirtyValues: true },
  })
  const description = useWatch({ control: form.control, name: "description" })
  const { errors, isDirty } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)

  const submit = form.handleSubmit((values) => {
    update.mutate(
      {
        title: values.title.trim(),
        handle: values.handle.trim(),
        description: values.description.trim(),
      },
      {
        onSuccess: () => toast.success(t("products.detail.saved")),
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })

  return (
    <CardForm
      title={t("products.detail.general")}
      {...(className ? { className } : {})}
      dirty={isDirty}
      saving={update.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field
        label={t("products.wizard.title")}
        htmlFor="detail-title"
        required
        error={message(errors.title?.message)}
      >
        <Input id="detail-title" {...form.register("title")} />
      </Field>
      <Field
        label={t("products.wizard.url")}
        htmlFor="detail-handle"
        hint={t("products.detail.handleHint")}
        error={message(errors.handle?.message)}
      >
        <div className="flex items-center rounded-md border bg-background">
          <span className="border-r px-3 font-mono text-[13px] text-muted-foreground">
            {prefix}
          </span>
          <input
            id="detail-handle"
            spellCheck={false}
            className="h-9 min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] outline-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
      <Field
        label={t("products.wizard.descriptionLabel")}
        htmlFor="detail-description"
        hint={t("products.wizard.words", {
          count: wordCount(description),
          suggested: SUGGESTED_WORDS,
        })}
      >
        <Textarea id="detail-description" className="min-h-56" {...form.register("description")} />
      </Field>
    </CardForm>
  )
}
