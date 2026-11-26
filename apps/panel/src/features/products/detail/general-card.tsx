import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { AiButton } from "@/features/ai/components/ai-button"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { isValidSlug } from "@/lib/slug"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"

const TITLE_MAX = 200

const schema = z.object({
  title: z.string().trim().min(2, { message: "products.errors.title" }).max(TITLE_MAX),
  handle: z.string().trim().refine(isValidSlug, { message: "products.errors.handle" }),
})
type Values = z.infer<typeof schema>

const valuesOf = (product: Pick<ProductDetail, "title" | "handle">): Values => ({
  title: product.title,
  handle: product.handle,
})

/**
 * Name and address; the address change keeps the old one reserved (F3.1).
 * The description is a card of its own, in the content editor (ADR-0055).
 */
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
  const saved = valuesOf(product)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    // A save elsewhere on the page reloads the product; edits here stay
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isDirty } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)

  const submit = form.handleSubmit((values) => {
    update.mutate(
      { title: values.title.trim(), handle: values.handle.trim() },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.product), FULL_RESET)
          toast.success(t("products.detail.saved"))
        },
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
        <div className="flex items-start gap-1.5">
          <Input
            placeholder={t("products.placeholders.title")}
            id="detail-title"
            className="min-w-0 flex-1"
            {...form.register("title")}
          />
          {/* A clearer name from the product's saved facts; "Kullan" fills the field, Save writes it */}
          <AiButton
            task="product_title"
            entity={{ type: "product", id: product.id }}
            size="icon"
            label={t("products.detail.aiTitle")}
            onUse={(text) => {
              form.setValue("title", text.slice(0, TITLE_MAX), {
                shouldDirty: true,
                shouldValidate: true,
              })
            }}
          />
        </div>
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
    </CardForm>
  )
}
