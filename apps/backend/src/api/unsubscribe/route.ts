import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recipientOfToken } from "../../lib/messaging/unsubscribe"
import { brandOf } from "../../workflows/messaging/brand"
import { unsubscribeByLinkWorkflow } from "../../workflows/messaging/email-links"
import { confirmForm, sendToStorefront, simplePage } from "../http/simple-page"

const tokenOf = (req: MedusaRequest): string => {
  const value = req.query["t"]
  return typeof value === "string" ? value : ""
}

const INVALID = { title: "Bağlantı geçersiz", body: "<p>Bu çıkış bağlantısı tanınmadı.</p>" }

/**
 * GET /unsubscribe?t=… (adr/0038 §1): the page a commercial e-mail's link
 * opens. Once the shop has a host, the storefront's own page answers it
 * (`/abonelik/cik`, Ek 2026-11-02); until then this one. Either asks to
 * confirm, so a mail scanner opening the link withdraws no one's consent.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop, storefrontUrl } = await brandOf(req.scope)
  if (storefrontUrl) {
    sendToStorefront(res, "unsubscribe", req.query["t"], storefrontUrl)
    return
  }
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
 * `List-Unsubscribe=One-Click`, which names this address whatever the
 * shop's host). Done once; again changes nothing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const { result } = await unsubscribeByLinkWorkflow(req.scope).run({
    input: { token: tokenOf(req) },
  })
  if (!result) {
    simplePage(res, 400, { shop, ...INVALID })
    return
  }
  simplePage(res, 200, {
    shop,
    title: "Çıkışınız alındı",
    body: "<p>Bu adrese artık kampanya e-postası gönderilmeyecek.</p>",
  })
}
