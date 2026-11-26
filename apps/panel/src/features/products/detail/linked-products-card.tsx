import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import type { LinkedProduct } from "@/features/products/api/product-edit"
import { errorText } from "@/lib/errors"
import { LinkedListField } from "./linked-list"

const L = "products.linked"

interface Values {
  upsells: LinkedProduct[]
  cross_sells: LinkedProduct[]
}

const ids = (list: readonly LinkedProduct[]) => list.map((product) => product.id)

/**
 * The "Bağlantılı ürünler" tab (S3, WooCommerce's "Linked Products"):
 * "Benzer / daha iyi ürünler", shown on the product's page in place of
 * its category's similar products, and "Birlikte alınanlar", offered in
 * the cart while it is there. Each is ordered by hand, twelve at most;
 * saved here or with the page's header save.
 */
export function LinkedProductsCard({ productId }: { productId: string }) {
  const { t } = useTranslation()
  const catalog = useQuery(productCatalogQuery(productId))
  const save = useSaveCatalog(productId)
  const saved: Values = {
    upsells: catalog.data?.upsells ?? [],
    cross_sells: catalog.data?.cross_sells ?? [],
  }
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const [upsells, crossSells] = useWatch({
    control: form.control,
    name: ["upsells", "cross_sells"],
  })
  if (!catalog.data) {
    return <Skeleton className="h-40 w-full rounded-lg" />
  }
  const submit = form.handleSubmit((values) => {
    save.mutate(
      {
        upsell_product_ids: ids(values.upsells),
        cross_sell_product_ids: ids(values.cross_sells),
      },
      {
        onSuccess: (answer) => {
          form.reset(
            { upsells: answer.upsells ?? [], cross_sells: answer.cross_sells ?? [] },
            FULL_RESET
          )
          toast.success(t("products.detail.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      bare
      title={t(`${L}.title`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <LinkedListField
        list="upsells"
        productId={productId}
        value={upsells}
        onChange={(next) => {
          form.setValue("upsells", next, { shouldDirty: true })
        }}
      />
      <LinkedListField
        list="cross_sells"
        productId={productId}
        value={crossSells}
        onChange={(next) => {
          form.setValue("cross_sells", next, { shouldDirty: true })
        }}
      />
    </CardForm>
  )
}
