import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2, Package, Plus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Pagination } from "@/components/patterns/pagination"
import { SearchInput } from "@/components/patterns/search-input"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  COLLECTION_PRODUCTS_PAGE_SIZE,
  collectionProductsQuery,
  useCollectionProducts,
} from "@/features/collections/api/collections"
import type { Collection } from "@/features/collections/api/collections"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { RecordPickerDialog } from "@/features/storefront/editor/forms/record-picker-dialog"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const P = "collections.products"

/** Products ticked in the picker, kept until "Ekle" adds them in one go. */
function AddProductsDialog({
  collectionId,
  onClose,
}: {
  collectionId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useCollectionProducts(collectionId)
  const [ticked, setTicked] = useState<string[]>([])
  return (
    <RecordPickerDialog
      kind="product"
      title={t(`${P}.addTitle`)}
      chosen={ticked}
      multiple
      onToggle={(option) => {
        setTicked((now) =>
          now.includes(option.id) ? now.filter((id) => id !== option.id) : [...now, option.id]
        )
      }}
      onClose={onClose}
      done={{
        label: t(`${P}.addSome`, { count: ticked.length, products: formatCount(ticked.length) }),
        busy: save.isPending,
        onDone: () => {
          save.mutate(
            { add: ticked },
            {
              onSuccess: () => {
                toast.success(t(`${P}.added`, { count: ticked.length }))
                onClose()
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        },
      }}
    />
  )
}

/**
 * The collection's products, searched by name a page at a time: "Ürün
 * ekle" picks several at once (one moved from another collection leaves
 * it, as a product is in one), the cross takes one out. Neither touches
 * the product itself.
 */
export function CollectionProductsCard({ collection }: { collection: Collection }) {
  const { t } = useTranslation()
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const list = useQuery(collectionProductsQuery(collection.id, { q, page }))
  const remove = useCollectionProducts(collection.id)
  const rows = list.data?.products ?? []

  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.hint`)}
      flush
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAdding(true)
          }}
        >
          <Plus />
          {t(`${P}.add`)}
        </Button>
      }
    >
      <div className="border-y px-5 py-3">
        <SearchInput
          value={q}
          placeholder={t(`${P}.search`)}
          onChange={(text) => {
            setQ(text)
            setPage(0)
          }}
        />
      </div>
      {list.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : list.isPending ? (
        <div className="flex justify-center py-10">
          <span className="sr-only">{t("common.loading")}</span>
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <Package className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t(q ? `${P}.noMatch` : `${P}.empty`)}
          </p>
        </div>
      ) : (
        <ul aria-label={t(`${P}.title`)} className="flex flex-col">
          {rows.map((product) => (
            <li
              key={product.id}
              className="flex items-center gap-3 border-t px-5 py-2.5 first:border-t-0"
            >
              <ProductThumb src={product.thumbnail} />
              <Link
                to="/products/$id"
                params={{ id: product.id }}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              >
                {product.title}
              </Link>
              <ProductStatusBadge status={product.status} />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t(`${P}.removeOf`, { name: product.title })}
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(
                    { remove: [product.id] },
                    {
                      onSuccess: () => toast.success(t(`${P}.removed`)),
                      onError: (failure) => toast.error(errorText(t, failure)),
                    }
                  )
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {list.data && list.data.count > COLLECTION_PRODUCTS_PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={COLLECTION_PRODUCTS_PAGE_SIZE}
          count={list.data.count}
          onPageChange={setPage}
        />
      ) : null}
      {adding ? (
        <AddProductsDialog
          collectionId={collection.id}
          onClose={() => {
            setAdding(false)
          }}
        />
      ) : null}
    </SectionCard>
  )
}
