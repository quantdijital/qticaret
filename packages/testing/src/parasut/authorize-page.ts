import type { ServerResponse } from "node:http"

/**
 * Paraşüt's authorize page (`/oauth/authorize`) as a signed-in user sees
 * it: which application asks for which access, "İzin ver" or "Reddet".
 * Allowed, it shows the code to paste into the shop's panel, as Paraşüt
 * does for an application without a redirect address of its own.
 */

export interface AuthorizePage {
  clientId: string
  /** The platform's name as registered with Paraşüt. */
  appName: string
  /** The signed-in user's company, as the page names the account. */
  account: string
  companyId: string
  issueCode: () => string
}

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)

const STYLE = `
  *{box-sizing:border-box}
  body{margin:0;font:15px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2937;background:#f3f4f6}
  header{background:#fff;border-bottom:1px solid #e5e7eb;padding:14px 24px;font-weight:700;font-size:18px;color:#ea580c}
  main{max-width:480px;margin:40px auto;padding:28px;background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-size:19px;margin:0 0 12px}
  ul{padding-left:20px;margin:12px 0 20px}
  .who{font-size:13px;color:#6b7280;margin:0 0 18px}
  .actions{display:flex;gap:10px}
  button{flex:1;height:42px;border-radius:6px;font:inherit;font-weight:600;cursor:pointer;border:1px solid #d1d5db;background:#fff}
  button.allow{background:#ea580c;border-color:#ea580c;color:#fff}
  input{width:100%;height:44px;padding:0 12px;font:15px ui-monospace,Menlo,monospace;border:1px solid #d1d5db;border-radius:6px;margin:10px 0}
  .note{font-size:13px;color:#6b7280}
`

function page(body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Paraşüt | Uygulama izni</title><style>${STYLE}</style></head><body><header>Paraşüt</header><main>${body}</main></body></html>`
}

/** GET asks; POST with the user's decision answers (`body` is the posted form). */
export function answerAuthorize(
  res: ServerResponse,
  request: { method: string | undefined; query: URLSearchParams; body: string },
  settings: AuthorizePage
): void {
  const post = request.method === "POST"
  const fields = post ? new URLSearchParams(request.body) : request.query
  const clientId = fields.get("client_id") ?? ""
  const reply = (status: number, body: string) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" })
    res.end(page(body))
  }
  if (clientId !== settings.clientId) {
    reply(
      400,
      "<h1>Uygulama tanınmadı</h1><p>Bu bağlantıdaki uygulama Paraşüt'te kayıtlı değil. Bağlantıyı mağaza panelinden yeniden açın.</p>"
    )
    return
  }
  if (!post) {
    const hidden = ["client_id", "redirect_uri", "response_type"]
      .map(
        (name) => `<input type="hidden" name="${name}" value="${escape(fields.get(name) ?? "")}">`
      )
      .join("")
    reply(
      200,
      `<h1>${escape(settings.appName)} Paraşüt hesabınıza erişmek istiyor</h1>
      <p class="who">${escape(settings.account)} hesabıyla giriş yaptınız · Firma no ${escape(settings.companyId)}</p>
      <p>İzin verirseniz bu uygulama:</p>
      <ul><li>Müşteri ve satış faturası kayıtlarınızı okuyup oluşturabilir,</li><li>e-Fatura ve e-Arşiv faturası düzenleyip iptal edebilir,</li><li>Fatura PDF'lerinizi indirebilir.</li></ul>
      <form method="post" action="/oauth/authorize">${hidden}<div class="actions"><button type="submit" name="decision" value="deny">Reddet</button><button class="allow" type="submit" name="decision" value="allow">İzin ver</button></div></form>`
    )
    return
  }
  if (fields.get("decision") !== "allow") {
    reply(
      200,
      `<h1>Erişim isteği reddedildi</h1><p>${escape(settings.appName)} hesabınıza erişemez. Bu sekmeyi kapatabilirsiniz.</p>`
    )
    return
  }
  reply(
    200,
    `<h1>Yetkilendirme kodu</h1><p>Bu kodu kopyalayıp mağaza panelindeki "Yetki kodu" alanına yapıştırın.</p>
    <input readonly value="${escape(settings.issueCode())}" onclick="this.select()" aria-label="Yetkilendirme kodu">
    <p class="note">Kod bir kez ve kısa süre için geçerlidir.</p>`
  )
}
