import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recipientOfToken } from "../../lib/messaging/unsubscribe"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { brandOf } from "../../workflows/messaging/brand"
import { confirmForm, simplePage } from "../http/simple-page"

const tokenOf = (req: MedusaRequest): string => {
  const value = req.query["t"]
  return typeof value === "string" ? value : ""
}

const INVALID = { title: "Bağlantı geçersiz", body: "<p>Bu çıkış bağlantısı tanınmadı.</p>" }

/**
 * GET /unsubscribe?t=… (adr/0038 §1): the page a commercial e-mail's link
 * opens. It asks to confirm, so a mail scanner opening the link does not
 * withdraw anyone's consent.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const token = tokenOf(req)
  if (!recipientOfToken(token)) {
    simplePage(res, 400, { shop, ...INVALID })
    return
  }
  simplePage(res, 200, {
    shop,
    title: "Kampanya iletilerinden çıkın",
    body:
      "<p>Bu adrese bundan sonra kampanya e-postası gönderilmez. Siparişlerinizle ilgili e-postalar gelmeye devam eder.</p>" +
      confirmForm(token, "Çıkışı onayla"),
  })
}

/**
 * POST /unsubscribe?t=…: withdraws the recipient's e-mail consent, from
 * the page's button or a mail client's one-click (RFC 8058,
 * `List-Unsubscribe=One-Click`). Done once; again changes nothing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const hash = recipientOfToken(tokenOf(req))
  if (!hash) {
    simplePage(res, 400, { shop, ...INVALID })
    return
  }
  await req.scope
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .revokeByHash("email", hash, "unsubscribe", { via: "link" })
  simplePage(res, 200, {
    shop,
    title: "Çıkışınız alındı",
    body: "<p>Bu adrese artık kampanya e-postası gönderilmeyecek.</p>",
  })
}
