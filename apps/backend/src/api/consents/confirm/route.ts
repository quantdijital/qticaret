import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"
import { brandOf } from "../../../workflows/messaging/brand"
import { confirmForm, simplePage } from "../../http/simple-page"

const tokenOf = (req: MedusaRequest): string => {
  const value = req.query["t"]
  return typeof value === "string" && /^[\w-]{20,100}$/.test(value) ? value : ""
}

/**
 * GET /consents/confirm?t=… (security review 2026-10-29): the page a
 * consent request's link opens. It asks first, so a mail scanner opening
 * the link records nothing.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const token = tokenOf(req)
  simplePage(res, token ? 200 : 400, {
    shop,
    title: token ? "İzninizi onaylayın" : "Bağlantı geçersiz",
    body: token
      ? "<p>Bu adres için kampanya iletileri izniyle ilgili bir istek var. İsteği siz yaptıysanız onaylayın.</p>" +
        confirmForm(token, "Onayla")
      : "<p>Bu onay bağlantısı tanınmadı.</p>",
  })
}

/** POST /consents/confirm?t=…: records the consent asked for; a used or late link records nothing. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { shopName: shop } = await brandOf(req.scope)
  const token = tokenOf(req)
  const confirmed = token
    ? await req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE).confirmConsentRequest(token)
    : null
  simplePage(res, confirmed ? 200 : 400, {
    shop,
    title: confirmed ? "Onaylandı" : "Bağlantı geçersiz",
    body: confirmed
      ? confirmed.status === "granted"
        ? "<p>İzniniz kaydedildi. Dilediğiniz zaman iletilerdeki bağlantıyla ya da hesabınızdan geri çekebilirsiniz.</p>"
        : "<p>İzniniz geri çekildi; size kampanya iletisi gönderilmeyecek.</p>"
      : "<p>Bu bağlantı kullanılmış ya da süresi dolmuş. İzni yeniden verebilirsiniz.</p>",
  })
}
