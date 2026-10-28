import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { escapeXml } from "../../lib/clients/xml"
import { recipientOfToken } from "../../lib/messaging/unsubscribe"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"
import { brandOf } from "../../workflows/messaging/brand"

// The page runs nothing and loads nothing; its one form posts back here
const PAGE_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"

const tokenOf = (req: MedusaRequest): string => {
  const value = req.query["t"]
  return typeof value === "string" ? value : ""
}

function page(res: MedusaResponse, status: number, shop: string, title: string, body: string) {
  res.setHeader("Content-Security-Policy", PAGE_POLICY)
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res
    .status(status)
    .send(
      `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeXml(title)}</title></head>` +
        `<body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#111827">` +
        `<p style="color:#6b7280;margin:0 0 8px">${escapeXml(shop)}</p><h1 style="font-size:20px">${escapeXml(title)}</h1>${body}</body></html>`
    )
}

/**
 * GET /unsubscribe?t=… (adr/0038 §1): the page a commercial e-mail's link
 * opens. It asks to confirm, so a mail scanner opening the link does not
 * withdraw anyone's consent.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName } = await brandOf(req.scope)
  const token = tokenOf(req)
  if (!recipientOfToken(token)) {
    page(res, 400, shopName, "Bağlantı geçersiz", "<p>Bu çıkış bağlantısı tanınmadı.</p>")
    return
  }
  page(
    res,
    200,
    shopName,
    "Kampanya iletilerinden çıkın",
    `<p>Bu adrese bundan sonra kampanya e-postası gönderilmez. Siparişlerinizle ilgili e-postalar gelmeye devam eder.</p>` +
      `<form method="post" action="?t=${escapeXml(encodeURIComponent(token))}"><button type="submit" style="padding:10px 16px;font-size:15px">Çıkışı onayla</button></form>`
  )
}

/**
 * POST /unsubscribe?t=…: withdraws the recipient's e-mail consent, from
 * the page's button or a mail client's one-click (RFC 8058,
 * `List-Unsubscribe=One-Click`). Done once; again changes nothing.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName } = await brandOf(req.scope)
  const hash = recipientOfToken(tokenOf(req))
  if (!hash) {
    page(res, 400, shopName, "Bağlantı geçersiz", "<p>Bu çıkış bağlantısı tanınmadı.</p>")
    return
  }
  await req.scope
    .resolve<MessagingModuleService>(MESSAGING_MODULE)
    .revokeByHash("email", hash, "unsubscribe", { via: "link" })
  page(
    res,
    200,
    shopName,
    "Çıkışınız alındı",
    "<p>Bu adrese artık kampanya e-postası gönderilmeyecek.</p>"
  )
}
