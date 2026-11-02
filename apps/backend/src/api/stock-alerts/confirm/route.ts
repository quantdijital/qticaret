import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { brandOf } from "../../../workflows/messaging/brand"
import { confirmStockAlertByLinkWorkflow } from "../../../workflows/messaging/email-links"
import { confirmForm, sendToStorefront, simplePage } from "../../http/simple-page"

const tokenOf = (req: MedusaRequest): string => {
  const value = req.query["t"]
  return typeof value === "string" && /^[\w-]{20,100}$/.test(value) ? value : ""
}

/**
 * GET /stock-alerts/confirm?t=… (F10.5): the page a guest's confirmation
 * link opens. Once the shop has a host, the storefront's own page answers
 * it (`/stok-bildirimi/onay`, adr/0038 Ek 2026-11-02); until then this
 * one. Either asks first, so a mail scanner turns nothing on.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop, storefrontUrl } = await brandOf(req.scope)
  if (storefrontUrl) {
    sendToStorefront(res, "stock_alert", req.query["t"], storefrontUrl)
    return
  }
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
    ? (await confirmStockAlertByLinkWorkflow(req.scope).run({ input: { token } })).result
    : null
  simplePage(res, confirmed ? 200 : 400, {
    shop,
    title: confirmed ? "Stok bildirimi açıldı" : "Bağlantı geçersiz",
    body: confirmed
      ? "<p>Ürün yeniden stoğa girdiğinde size bir kez e-posta gönderilecek.</p>"
      : "<p>Bu bağlantı kullanılmış ya da süresi dolmuş. Ürün sayfasından yeniden isteyebilirsiniz.</p>",
  })
}
