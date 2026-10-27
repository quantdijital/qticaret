import type { ServerResponse } from "node:http"
import type { FakeCheckoutForm, PayOutcome } from "./checkout-form"

/**
 * The fake iyzico's payment page (adr/0028): no card fields, a button per
 * outcome. Like iyzico's page it sends the shopper's browser back to the
 * shop's `callbackUrl` with the token: a 307 keeps the form post.
 */

export const PAGE_PATH = /^\/fake-cpp\/([0-9a-f-]{36})$/

const OUTCOMES: Readonly<Record<string, PayOutcome>> = {
  success: { status: "SUCCESS", fraudStatus: 1 },
  failed: { status: "FAILURE", fraudStatus: 1 },
  review: { status: "SUCCESS", fraudStatus: 0 },
}

const STYLE = `
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; padding: 32px 24px; max-width: 480px; color: #1e293b; background: #f8fafc }
  .note { font-size: 13px; color: #64748b } .amount { font-size: 28px; font-weight: 600; margin: 8px 0 20px }
  label { display: block; font-size: 13px; margin-bottom: 6px } select { width: 100%; padding: 8px; font: inherit; margin-bottom: 20px }
  .actions { display: grid; gap: 8px } button { font: inherit; padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer }
  button.primary { background: #1e64ff; border-color: #1e64ff; color: #fff } button small { display: block; font-size: 12px; opacity: .75 }
`

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)

function page(form: FakeCheckoutForm): string {
  const options = form.enabledInstallments
    .map(
      (count) =>
        `<option value="${String(count)}">${count === 1 ? "Tek çekim" : `${String(count)} taksit`}</option>`
    )
    .join("")
  const body = form.result
    ? `<p>Bu form ödendi (${form.result.paymentStatus}).</p>`
    : `<div class="amount">${escape(form.paidPrice)} ${escape(form.currency)}</div>
      <form method="post">
        <input type="hidden" name="token" value="${escape(form.token)}">
        <label for="installment">Taksit</label><select id="installment" name="installment">${options}</select>
        <div class="actions">
          <button class="primary" name="outcome" value="success">Ödemeyi onayla<small>Ödendi, sahtekârlık kontrolü onaylı</small></button>
          <button name="outcome" value="failed">Kart reddedildi<small>Banka onaylamadı</small></button>
          <button name="outcome" value="review">Ödendi, incelemede<small>fraudStatus 0: mağaza onayı bekler</small></button>
        </div>
      </form>`
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sahte iyzico</title><style>${STYLE}</style></head><body><p class="note">Yerel deneme sunucusu (sahte iyzico). Kart bilgisi istenmez; seçtiğiniz sonuçla mağazaya dönülür.</p>${body}</body></html>`
}

/** GET shows the page; POST pays the form and sends the browser, with the token, to the shop. */
export function answerPaymentPage(
  res: ServerResponse,
  method: string | undefined,
  form: FakeCheckoutForm | undefined,
  fields: Record<string, string>,
  pay: (token: string, outcome: PayOutcome) => void
): void {
  if (!form) {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" })
    res.end("<p>Bu ödeme formu bulunamadı.</p>")
    return
  }
  const outcome = OUTCOMES[fields["outcome"] ?? ""]
  if (method !== "POST" || !outcome || form.result) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(page(form))
    return
  }
  const installment = Number(fields["installment"])
  pay(form.token, {
    ...outcome,
    installment: form.enabledInstallments.includes(installment) ? installment : 1,
  })
  res.writeHead(307, { location: form.callbackUrl })
  res.end()
}
