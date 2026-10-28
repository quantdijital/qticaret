import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ValidationError } from "../../../../../lib/errors"
import { WISHLIST_MODULE } from "../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../modules/wishlist/service"
import type { StorePostWishlistItemType } from "./validators"

interface ProductRow {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  variants?: ({ id: string } | null)[] | null
}

/** Published products by id, as a list shows them. */
async function publishedProducts(scope: MedusaContainer, ids: string[]): Promise<ProductRow[]> {
  if (ids.length === 0) {
    return []
  }
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "title", "handle", "thumbnail", "variants.id"],
    filters: { id: ids, status: "published" },
  })
  return data
}

/** The customer's saved products, newest first; a product no longer sold is left out. */
async function wishlistOf(scope: MedusaContainer, customerId: string) {
  const items = await scope
    .resolve<WishlistModuleService>(WISHLIST_MODULE)
    .listWishlistItems({ customer_id: customerId }, { order: { created_at: "DESC" }, take: 200 })
  const products = new Map(
    (await publishedProducts(scope, [...new Set(items.map((item) => item.product_id))])).map(
      (product) => [product.id, product]
    )
  )
  return items.flatMap((item) => {
    const product = products.get(item.product_id)
    return product
      ? [
          {
            id: item.id,
            variant_id: item.variant_id === "" ? null : item.variant_id,
            created_at: item.created_at,
            product: {
              id: product.id,
              title: product.title,
              handle: product.handle,
              thumbnail: product.thumbnail,
            },
          },
        ]
      : []
  })
}

/** GET /store/customers/me/wishlist (F10.4): the customer's saved products. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ items: await wishlistOf(req.scope, req.auth_context.actor_id) })
}

/** POST /store/customers/me/wishlist: keeps a product (a variant of it) for later. */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostWishlistItemType>,
  res: MedusaResponse
): Promise<void> {
  const { product_id: productId, variant_id: variantId } = req.validatedBody
  const [product] = await publishedProducts(req.scope, [productId])
  const variants = new Set((product?.variants ?? []).flatMap((each) => (each ? [each.id] : [])))
  if (!product || (variantId !== undefined && !variants.has(variantId))) {
    throw new ValidationError("wishlist.product_unknown", { field: "product_id" })
  }
  await req.scope.resolve<WishlistModuleService>(WISHLIST_MODULE).keep({
    customer_id: req.auth_context.actor_id,
    product_id: productId,
    variant_id: variantId ?? null,
  })
  res.json({ items: await wishlistOf(req.scope, req.auth_context.actor_id) })
}
