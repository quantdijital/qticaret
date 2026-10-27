import type { ServerResponse } from "node:http"
import { FAKE_INSTALLMENT_RATES } from "./handlers"
import type { FakePayment, Fields } from "./handlers"

/**
 * The fake's stand-in for PayTR's iFrame form (adr/0028). No card fields:
 * three buttons for the outcomes a shop must handle. The form posts to the
 * top window, as PayTR's sends the shopper back to the shop's page.
 */

/** Paid and notified, refused and notified, or paid with the notification lost. */
export type PageOutcome = "success" | "failed" | "silent"

export const FORM_PATH = /^\/odeme\/guvenli\/([0-9a-f]{1,128})$/

const OUTCOMES: readonly PageOutcome[] = ["success", "failed", "silent"]

export interface PaymentForm {
  find: (token: string) => FakePayment | undefined
  complete: (payment: FakePayment, outcome: PageOutcome, installments: number) => Promise<void>
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)

const lira = (kurus: number) =>
  `${(kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`

/** Kuruş charged for `count` installments: PayTR adds the card family's surcharge. */
export function totalWithSurcharge(amount: number, count: number): number {
  const rate = Number(FAKE_INSTALLMENT_RATES[`taksit_${String(count)}`] ?? 0)
  return Math.round(amount * (1 + rate / 100))
}

/** The counts the form offers: what the rates know, up to the shop's limit. */
export function installmentChoices(payment: FakePayment): number[] {
  const max = payment.maxInstallment === 0 ? 12 : payment.maxInstallment
  return [1, 2, 3, 6, 12].filter((count) => count <= max)
}

const STYLE = `
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; color: #1c1917; background: #fafaf9 }
  .note { font-size: 13px; color: #78716c; margin: 0 0 16px }
  .amount { font-size: 28px; font-weight: 600; margin: 4px 0 16px }
  .badge { display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 99px; background: #fef3c7; color: #92400e }
  label { display: block; font-size: 13px; margin: 0 0 6px }
  select { width: 100%; padding: 8px; font: inherit; margin: 0 0 20px }
  .actions { display: grid; gap: 8px }
  button { font: inherit; padding: 10px 14px; border-radius: 8px; border: 1px solid #d6d3d1; background: #fff; cursor: pointer }
  button.primary { background: #15803d; color: #fff; border-color: #15803d }
  button small { display: block; font-size: 12px; opacity: .75 }
`

function page(body: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sahte PayTR</title><style>${STYLE}</style></head><body>${body}</body></html>`
}

/** The form for a pending payment, or where a finished one stands. */
export function paymentFormPage(payment: FakePayment, token: string): string {
  const note = `<p class="note">Yerel deneme sunucusu (sahte PayTR). Kart bilgisi istenmez; seçtiğiniz sonuç mağazaya imzalı bildirimle gider.</p>`
  if (payment.status !== "pending") {
    const back = payment.status === "failed" ? payment.failUrl : payment.okUrl
    return page(
      `${note}<p>Bu ödeme sonuçlandı: <strong>${payment.status === "success" ? "ödendi" : "reddedildi"}</strong>.</p><p><a href="${escape(back)}" target="_top">Mağazaya dön</a></p>`
    )
  }
  const options = installmentChoices(payment)
    .map((count) => {
      const total = totalWithSurcharge(payment.paymentAmount, count)
      const label = count === 1 ? "Tek çekim" : `${String(count)} taksit`
      return `<option value="${String(count)}">${label} · ${lira(total)}</option>`
    })
    .join("")
  return page(`${note}
    ${payment.testMode ? '<span class="badge">Test modu</span>' : ""}
    <div class="amount">${lira(payment.paymentAmount)}</div>
    <form method="post" action="/odeme/guvenli/${escape(token)}" target="_top">
      <label for="installments">Taksit</label>
      <select id="installments" name="installments">${options}</select>
      <div class="actions">
        <button class="primary" name="outcome" value="success">Ödemeyi onayla<small>Ödendi, bildirim mağazaya gider</small></button>
        <button name="outcome" value="failed">Kart reddedildi<small>Banka onaylamadı, bildirim gider</small></button>
        <button name="outcome" value="silent">Ödendi, bildirim kayboldu<small>Mağaza ödemeyi durum sorgusuyla bulmalı</small></button>
      </div>
    </form>`)
}

/** GET shows the form; POST completes the payment and sends the shopper back. */
export async function answerPaymentForm(
  res: ServerResponse,
  method: string | undefined,
  token: string,
  fields: Fields,
  form: PaymentForm
): Promise<void> {
  const payment = form.find(token)
  if (!payment) {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" })
    res.end(page("<p>Bu ödeme formu bulunamadı ya da süresi doldu.</p>"))
    return
  }
  const outcome = OUTCOMES.find((value) => value === fields["outcome"])
  if (method !== "POST" || !outcome || payment.status !== "pending") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(paymentFormPage(payment, token))
    return
  }
  const asked = Number(fields["installments"])
  const installments = installmentChoices(payment).includes(asked) ? asked : 1
  await form.complete(payment, outcome, installments)
  res.writeHead(303, { location: outcome === "failed" ? payment.failUrl : payment.okUrl })
  res.end()
}
