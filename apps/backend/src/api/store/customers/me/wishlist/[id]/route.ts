import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../../../modules/wishlist"
import type WishlistModuleService from "../../../../../../modules/wishlist/service"

/** DELETE /store/customers/me/wishlist/:id (F10.4): the customer's own item only; another's is not found. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const wishlist = req.scope.resolve<WishlistModuleService>(WISHLIST_MODULE)
  const id = req.params["id"] ?? ""
  const [own] = await wishlist.listWishlistItems(
    { id, customer_id: req.auth_context.actor_id },
    { take: 1, select: ["id"] }
  )
  if (own) {
    await wishlist.deleteWishlistItems([own.id])
  }
  res.json({ id, deleted: own !== undefined })
}
