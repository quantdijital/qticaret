import type { ServerResponse } from "node:http"
import { cardFormPage } from "./card-form"
import type { CardFormValues } from "./card-form"
import { DEFAULT_CARD_NUMBER, cardOf, digitsOf, outcomeOf, passesLuhn } from "./cards"
import type { FakeCard } from "./cards"
import type { FakePayment, Fields, SecureStep } from "./handlers"
import { TEST_RATES, allowedCounts, chargedAmount } from "./rates"
import type { InstallmentRates } from "./rates"
import { finishedPage, missingPage, securePage } from "./secure-page"

/**
 * The fake's stand-in for PayTR's iFrame (adr/0028), as the shopper sees
 * the real one: the card form (`card-form.ts`), then the card bank's
 * 3-D Secure page (`secure-page.ts`), then the shop's page. The card's
 * number decides the bank's answer (`cards.ts`, README.md).
 *
 * Two doors for tests only, never shown: a POST carrying `outcome`
 * finishes the payment at once (the backend's HTTP tests), and
 * `?notification=lost` on the form's address pays without telling the shop.
 */

/** Paid and notified, refused and notified, or paid with the notification lost. */
export type PageOutcome = "success" | "failed" | "silent"

export const FORM_PATH = /^\/odeme\/guvenli\/([0-9a-f]{1,128})(\/3d)?$/

const OUTCOMES: readonly PageOutcome[] = ["success", "failed", "silent"]
const LOST_FLAG = "notification=lost"

export interface Completion {
  outcome: PageOutcome
  installments: number
  totalAmount: number
  card?: FakeCard
  /** PayTR's `failed_reason_code` and `failed_reason_msg` for a refusal. */
  reason?: { code: string; message: string }
}

export interface PaymentForm {
  rates: InstallmentRates
  find: (token: string) => FakePayment | undefined
  complete: (payment: FakePayment, completion: Completion) => Promise<void>
  /** Keeps the state after a step that changed it. */
  save: () => void
}

/** What the bank answers a refused card with (PayTR's code 0 carries the bank's words). */
const REFUSALS: Record<Exclude<SecureStep["outcome"], "success">, Completion["reason"]> = {
  refused: { code: "0", message: "İşlem onaylanmadı. Kartınızı veren bankayla görüşün." },
  insufficient: { code: "0", message: "Kart limiti yetersiz." },
}

/** Kuruş charged for `count` installments on the default World card (tests price with it). */
export function totalWithSurcharge(
  amount: number,
  count: number,
  rates: InstallmentRates = TEST_RATES
): number {
  return chargedAmount(rates, cardOf(DEFAULT_CARD_NUMBER).family, amount, count)
}

/** The counts the default World card may pay in, up to the shop's limit. */
export function installmentChoices(
  payment: FakePayment,
  rates: InstallmentRates = TEST_RATES
): number[] {
  return allowedCounts(rates, cardOf(DEFAULT_CARD_NUMBER).family, payment.maxInstallment)
}

const html = (res: ServerResponse, status: number, body: string) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" })
  res.end(body)
}

const redirect = (res: ServerResponse, location: string) => {
  res.writeHead(303, { location })
  res.end()
}

/** The card the form was sent, or what is wrong with it, in PayTR's words. */
function readCard(
  fields: Fields,
  payment: FakePayment,
  rates: InstallmentRates,
  now: number
): { values: CardFormValues; error?: string; card?: FakeCard; totalAmount?: number } {
  const number = digitsOf(fields["card_number"] ?? "")
  const values: CardFormValues = {
    owner: (fields["cc_owner"] ?? "").trim().slice(0, 50),
    number,
    expiry: (fields["expiry"] ?? "").trim().slice(0, 7),
    installments: Number(fields["installments"] ?? 1),
  }
  const expiry = /^(\d{2})\s*\/\s*(\d{2})$/.exec(values.expiry)
  const month = Number(expiry?.[1])
  const ends = Date.UTC(2000 + Number(expiry?.[2]), month, 1)
  if (values.owner.length < 3) {
    return { values, error: "Kart üzerindeki adı ve soyadı yazın." }
  }
  if (!passesLuhn(number)) {
    return { values, error: "Kart numarası geçersiz. Numarayı kontrol edip yeniden yazın." }
  }
  if (!expiry || month < 1 || month > 12) {
    return { values, error: "Son kullanma tarihini AA/YY biçiminde yazın." }
  }
  if (ends <= now) {
    return { values, error: "Kartınızın son kullanma tarihi geçmiş." }
  }
  if (!new RegExp(`^\\d{${/^3[47]/.test(number) ? "4" : "3"}}$`).test(fields["cvv"] ?? "")) {
    return { values, error: "Kartın arkasındaki güvenlik kodunu (CVV) yazın." }
  }
  const card = cardOf(number)
  if (!allowedCounts(rates, card.family, payment.maxInstallment).includes(values.installments)) {
    return { values, error: "Bu kart ile seçilen taksit yapılamıyor. Başka bir seçenek seçin." }
  }
  const totalAmount = chargedAmount(rates, card.family, payment.paymentAmount, values.installments)
  return { values, card, totalAmount }
}

/**
 * GET shows the form or the 3-D Secure page; POST moves the payment on
 * and, once the bank has answered, sends the shopper back to the shop.
 */
export async function answerPaymentForm(
  res: ServerResponse,
  request: { method: string | undefined; token: string; secure: boolean; query: string },
  fields: Fields,
  form: PaymentForm
): Promise<void> {
  const payment = form.find(request.token)
  if (!payment) {
    html(res, 404, missingPage())
    return
  }
  const lost = new URLSearchParams(request.query).get("notification") === "lost"
  const suffix = lost ? `?${LOST_FLAG}` : ""
  const formUrl = `/odeme/guvenli/${request.token}${suffix}`
  const secureUrl = `/odeme/guvenli/${request.token}/3d${suffix}`
  const post = request.method === "POST"
  const outcome = OUTCOMES.find((value) => value === fields["outcome"])
  if (payment.status !== "pending") {
    html(res, 200, finishedPage(payment))
    return
  }
  if (!request.secure && post && outcome) {
    const asked = Number(fields["installments"])
    const installments = installmentChoices(payment, form.rates).includes(asked) ? asked : 1
    const totalAmount = totalWithSurcharge(payment.paymentAmount, installments, form.rates)
    await form.complete(payment, { outcome, installments, totalAmount })
    redirect(res, outcome === "failed" ? payment.failUrl : payment.okUrl)
    return
  }
  const now = Date.now()
  if (!request.secure) {
    const view = { payment, rates: form.rates, action: formUrl }
    if (!post) {
      // Back from the bank's page by "İptal": the card form again, the step dropped
      const notice = payment.secure ? "Ödeme doğrulanmadı. Kart bilgilerinizi yeniden girin." : ""
      if (payment.secure) {
        delete payment.secure
        form.save()
      }
      html(res, 200, cardFormPage(notice ? { ...view, notice } : view))
      return
    }
    const read = readCard(fields, payment, form.rates, now)
    if (read.error !== undefined || !read.card || read.totalAmount === undefined) {
      html(res, 200, cardFormPage({ ...view, values: read.values, error: read.error ?? "" }))
      return
    }
    payment.secure = {
      card: read.card,
      outcome: outcomeOf(read.values.number),
      installments: read.values.installments,
      totalAmount: read.totalAmount,
      lost,
    }
    form.save()
    redirect(res, secureUrl)
    return
  }
  const step = payment.secure
  if (!step) {
    redirect(res, formUrl)
    return
  }
  const page = { payment, step, action: secureUrl, cancel: formUrl, now }
  if (!post) {
    html(res, 200, securePage(page))
    return
  }
  if (!/^\d{6}$/.test((fields["sms_code"] ?? "").trim())) {
    html(res, 200, securePage({ ...page, error: "Doğrulama şifresi 6 haneli olmalı." }))
    return
  }
  delete payment.secure
  const base = { installments: step.installments, totalAmount: step.totalAmount, card: step.card }
  if (step.outcome !== "success") {
    const reason = REFUSALS[step.outcome]
    await form.complete(payment, { ...base, outcome: "failed", ...(reason ? { reason } : {}) })
    redirect(res, payment.failUrl)
    return
  }
  await form.complete(payment, { ...base, outcome: step.lost ? "silent" : "success" })
  redirect(res, payment.okUrl)
}
