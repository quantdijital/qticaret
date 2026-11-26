import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import { PURCHASE_LIMIT_MAX, readLimit } from "@/features/products/purchase-limit"
import { errorText } from "@/lib/errors"

const P = "products.purchaseLimit"

interface Values {
  /** Empty: no limit. */
  max_quantity: string
}

/**
 * "En çok satın alma adedi" in the Gelişmiş tab (S5; WooCommerce's "Sold
 * individually" is 1): the most of the product, its variants together,
 * one order may hold. Empty is no limit. The server refuses more as lines
 * are added and at checkout; the storefront's count stops there.
 */
export function PurchaseLimitCard({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const catalog = useQuery(productCatalogQuery(productId))
  const save = useSaveCatalog(productId)
  const saved: Values = {
    max_quantity:
      catalog.data?.max_quantity === null || catalog.data?.max_quantity === undefined
        ? ""
        : String(catalog.data.max_quantity),
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  if (!catalog.data) {
    return <Skeleton className="h-28 w-full rounded-lg" />
  }
  const invalid = form.formState.errors.max_quantity !== undefined
  const submit = form.handleSubmit((values) => {
    const limit = readLimit(values.max_quantity)
    if (limit === undefined) {
      return
    }
    save.mutate(
      { max_quantity: limit },
      {
        onSuccess: () => {
          form.reset(values, FULL_RESET)
          toast.success(t("products.detail.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      bare
      title={t(`${P}.title`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <Field
        label={t(`${P}.label`)}
        htmlFor="purchase-limit"
        hint={t(`${P}.hint`)}
        error={invalid ? t(`${P}.invalid`, { max: PURCHASE_LIMIT_MAX }) : undefined}
      >
        <Input
          id="purchase-limit"
          inputMode="numeric"
          className="max-w-40"
          placeholder={t(`${P}.none`)}
          aria-invalid={invalid}
          {...form.register("max_quantity", {
            validate: (value) => readLimit(value) !== undefined,
          })}
        />
      </Field>
    </CardForm>
  )
}
