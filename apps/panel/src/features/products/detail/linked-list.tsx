import { GripVertical } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { LinkedProduct } from "@/features/products/api/product-edit"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductThumb } from "@/features/products/components/product-thumb"
import { LINKED_MAX, moved, withAdded } from "@/features/products/linked-products"
import type { LinkedList as ListKey } from "@/features/products/linked-products"
import { RowActions } from "@/features/settings/components/storefront-rows"
import { sdk } from "@/lib/sdk"

const L = "products.linked"
const RESULTS = 20

/**
 * One list of linked products (S3): a search to add one (the product
 * itself and those listed already are not offered), then the list in its
 * order, each row dragged by its handle or moved by its arrows, and
 * removed by its bin.
 */
export function LinkedListField({
  list,
  productId,
  value,
  onChange,
}: {
  list: ListKey
  productId: string
  value: readonly LinkedProduct[]
  onChange: (next: LinkedProduct[]) => void
}) {
  const { t } = useTranslation()
  // The rows a search found, for the picked one's picture and status
  const found = useRef(new Map<string, LinkedProduct>())
  const [dragged, setDragged] = useState<number | null>(null)
  const listed = new Set(value.map((each) => each.id))
  const full = value.length >= LINKED_MAX
  const search = async (q: string): Promise<PickerOption[]> => {
    const { products } = await sdk.admin.product.list({
      fields: "id,title,handle,status,thumbnail",
      limit: RESULTS,
      ...(q ? { q } : {}),
    })
    return products.flatMap((product) => {
      if (product.id === productId || listed.has(product.id)) {
        return []
      }
      found.current.set(product.id, {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        thumbnail: product.thumbnail ?? null,
      })
      return [{ id: product.id, label: product.title }]
    })
  }
  const inputId = `linked-${list}`
  return (
    <Field
      label={t(`${L}.${list}.label`)}
      htmlFor={inputId}
      hint={full ? t(`${L}.full`, { max: LINKED_MAX }) : t(`${L}.${list}.hint`)}
    >
      <div className="flex flex-col gap-3">
        <SearchPicker
          id={inputId}
          value={null}
          disabled={full}
          onChange={(picked) => {
            const row = picked ? found.current.get(picked.id) : undefined
            if (row) {
              onChange(withAdded(value, row))
            }
          }}
          search={search}
          queryKey={["products", "linked-search", productId, list, [...listed].sort()]}
          placeholder={t(`${L}.add`)}
          empty={t(`${L}.noResults`)}
        />
        {value.length > 0 ? (
          <ol
            className="flex flex-col divide-y rounded-md border"
            aria-label={t(`${L}.${list}.label`)}
          >
            {value.map((product, index) => (
              <li
                key={product.id}
                className={cn(
                  "flex min-w-0 items-center gap-2 py-1.5 pr-1.5 pl-1",
                  dragged === index && "opacity-50"
                )}
                onDragOver={(event) => {
                  if (dragged !== null) {
                    event.preventDefault()
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragged !== null) {
                    onChange(moved(value, dragged, index))
                  }
                  setDragged(null)
                }}
              >
                <span
                  draggable
                  aria-hidden="true"
                  className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", product.id)
                    const row = event.currentTarget.closest("li")
                    if (row) {
                      event.dataTransfer.setDragImage(row, 16, 16)
                    }
                    setDragged(index)
                  }}
                  onDragEnd={() => {
                    setDragged(null)
                  }}
                >
                  <GripVertical className="size-3.5" />
                </span>
                <ProductThumb src={product.thumbnail} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm">{product.title}</span>
                {product.status === "published" ? null : (
                  <ProductStatusBadge status={product.status} />
                )}
                <RowActions
                  index={index}
                  count={value.length}
                  item={product.title}
                  onMove={(to) => {
                    onChange(moved(value, index, to))
                  }}
                  onRemove={() => {
                    onChange(value.filter((each) => each.id !== product.id))
                  }}
                />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Field>
  )
}
