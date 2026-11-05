import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import { useUpdateProduct } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { SummaryField } from "@/features/products/components/summary-field"
import { sameSummary, summaryOf } from "@/features/products/summary-lines"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { isValidSlug } from "@/lib/slug"
import { CardForm } from "@/components/patterns/card-form"

const schema = z.object({
  title: z.string().trim().min(2, { message: "products.errors.title" }).max(200),
  handle: z.string().trim().refine(isValidSlug, { message: "products.errors.handle" }),
  // The editor's rows as typed; what is saved is their tidy lines (`summaryOf`)
  summary: z.array(z.string()),
})
type Values = z.infer<typeof schema>

const NO_LINES: readonly string[] = []

const valuesOf = (
  product: Pick<ProductDetail, "title" | "handle">,
  summary: readonly string[]
): Values => ({ title: product.title, handle: product.handle, summary: [...summary] })

/**
 * Name, address and the short description (the owner, 2026-11-05: up to
 * five lines under the name, above the price). The address change keeps
 * the old one reserved (F3.1). One save writes what changed: the name and
 * address on the product, the lines through the catalog fields. The long
 * description is a card of its own, in the content editor (ADR-0055).
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
  const catalog = useQuery(productCatalogQuery(product.id))
  const saveCatalog = useSaveCatalog(product.id)
  const prefix = useProductPathPrefix()
  const storedLines = catalog.data?.summary ?? NO_LINES
  const saved = valuesOf(product, storedLines)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: saved,
    // A save elsewhere on the page reloads the product; edits here stay
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, dirtyFields } = form.formState
  const rows = useWatch({ control: form.control, name: "summary" })
  // An empty row added and left is no change
  const dirty =
    dirtyFields.title === true || dirtyFields.handle === true || !sameSummary(rows, storedLines)
  const message = (key: string | undefined) => (key ? t(key) : undefined)

  const submit = form.handleSubmit(async (values) => {
    const title = values.title.trim()
    const handle = values.handle.trim()
    const lines = summaryOf(values.summary)
    const named = title !== saved.title || handle !== saved.handle
    const described = !sameSummary(lines, storedLines)
    if (!named && !described) {
      return
    }
    try {
      const result = named ? await update.mutateAsync({ title, handle }) : null
      const stored = described
        ? (await saveCatalog.mutateAsync({ summary: lines.length > 0 ? lines : null })).summary
        : storedLines
      form.reset(valuesOf(result?.product ?? product, stored), FULL_RESET)
      toast.success(t("products.detail.saved"))
    } catch (failure) {
      toast.error(errorText(t, failure))
    }
  })

  return (
    <CardForm
      title={t("products.detail.general")}
      {...(className ? { className } : {})}
      dirty={dirty}
      saving={update.isPending || saveCatalog.isPending}
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
      {catalog.data ? (
        <Controller
          control={form.control}
          name="summary"
          render={({ field }) => <SummaryField value={field.value} onChange={field.onChange} />}
        />
      ) : (
        <Skeleton className="h-24 w-full rounded-md" />
      )}
    </CardForm>
  )
}
