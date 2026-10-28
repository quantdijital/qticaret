import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BACK_IN_STOCK_MODULE } from "../../../modules/back-in-stock"
import type BackInStockModuleService from "../../../modules/back-in-stock/service"
import { brandOf } from "../../../workflows/messaging/brand"
import { confirmForm, simplePage } from "../../http/simple-page"

const tokenOf = (req: MedusaRequest): string => {
  const value = req.query["t"]
  return typeof value === "string" && /^[\w-]{20,100}$/.test(value) ? value : ""
}

/**
 * GET /stock-alerts/confirm?t=… (F10.5): the page a guest's confirmation
 * link opens; it asks first, so a mail scanner opening the link turns
 * nothing on.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const token = tokenOf(req)
  simplePage(res, token ? 200 : 400, {
    shop,
    title: token ? "Stok bildirimini onaylayın" : "Bağlantı geçersiz",
    body: token
      ? "<p>Ürün yeniden stoğa girdiğinde bu adrese bir kez haber verilecek.</p>" +
        confirmForm(token, "Bildirimi onayla")
      : "<p>Bu onay bağlantısı tanınmadı.</p>",
  })
}

/** POST /stock-alerts/confirm?t=…: turns the guest's alert on; a used or late link does nothing. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const token = tokenOf(req)
  const confirmed = token
    ? await req.scope.resolve<BackInStockModuleService>(BACK_IN_STOCK_MODULE).confirm(token)
    : null
  simplePage(res, confirmed ? 200 : 400, {
    shop,
    title: confirmed ? "Stok bildirimi açıldı" : "Bağlantı geçersiz",
    body: confirmed
      ? "<p>Ürün yeniden stoğa girdiğinde size bir kez e-posta gönderilecek.</p>"
      : "<p>Bu bağlantı kullanılmış ya da süresi dolmuş. Ürün sayfasından yeniden isteyebilirsiniz.</p>",
  })
}
