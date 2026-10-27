import { fromMedusaAmount } from "../money"
import type { orderPaymentDetails } from "../../workflows/payments/payment-details"
import type { EvidenceChargeback, EvidenceOrder } from "./evidence"

/**
 * The evidence document's markup: Turkish, for the provider and the bank
 * (a document, not panel UI; F19 brings other languages). Every value is
 * escaped; no script, no outside resource.
 */

const REASONS: Readonly<Record<string, string>> = {
  not_received: "Ürün ulaşmadı",
  unauthorized: "Yetkisiz işlem",
  not_as_described: "Ürün tarif edildiği gibi değil",
  duplicate: "Mükerrer tahsilat",
  other: "Diğer",
}

const escape = (value: string | number | null | undefined): string =>
  String(value ?? "").replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`)

const date = (value: Date | string | null | undefined): string =>
  value
    ? new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(new Date(value))
    : "—"

const kurusText = (kurus: number, currency: string) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: currency.toUpperCase() }).format(
    kurus / 100
  )

const lira = (amount: number, currency: string) =>
  kurusText(fromMedusaAmount(amount, { allowRounding: true }), currency)

const rows = (pairs: [string, string][]) =>
  `<table>${pairs.map(([key, value]) => `<tr><th>${escape(key)}</th><td>${value}</td></tr>`).join("")}</table>`

const STYLE = `body{font:14px/1.5 system-ui,sans-serif;color:#111;max-width:820px;margin:32px auto;padding:0 24px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
p.lead{color:#555;margin:0 0 16px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}
th{width:38%;color:#444;font-weight:600}.note{color:#555;font-size:13px}@media print{body{margin:0}}`

export function renderEvidence(input: {
  chargeback: EvidenceChargeback
  order: EvidenceOrder
  payments: Awaited<ReturnType<typeof orderPaymentDetails>>
  generatedAt: Date
}): string {
  const { chargeback, order, payments } = input
  const currency = order.currency_code
  const address = order.shipping_address ?? {}
  const items = order.items
    .map(
      (item) =>
        `<tr><td>${escape(item.title)}</td><td>${escape(item.quantity)}</td><td>${lira(item.total, currency)}</td></tr>`
    )
    .join("")
  const payment = payments.payments[0]
  const shipments = order.fulfillments.length
    ? order.fulfillments
        .map((each, index) =>
          rows([
            [`Gönderi ${String(index + 1)}: hazırlandı`, date(each.created_at)],
            ["Kargoya verildi", date(each.shipped_at)],
            ["Teslim edildi", date(each.delivered_at)],
            ["Takip numarası", escape(each.tracking.join(", ") || "—")],
          ])
        )
        .join("")
    : `<p class="note">Bu sipariş için kargo kaydı yok.</p>`
  const refunds = payments.refunds.length
    ? rows(
        payments.refunds.map((refund) => [
          `${date(refund.created_at)} (${refund.reference})`,
          `${kurusText(refund.amount, currency)} · ${escape(refund.status)}`,
        ])
      )
    : `<p class="note">Bu sipariş için iade yapılmadı.</p>`
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Ters ibraz belgeleri: sipariş #${escape(order.display_id)}</title><style>${STYLE}</style></head><body>
<h1>Ters ibraz belgeleri: sipariş #${escape(order.display_id)}</h1>
<p class="lead">Hazırlanma: ${date(input.generatedAt)}</p>
<h2>İtiraz</h2>${rows([
    ["Sağlayıcı", escape(chargeback.provider)],
    ["Sağlayıcı referansı", escape(chargeback.provider_reference ?? "—")],
    ["İtiraz edilen tutar", kurusText(chargeback.amount, chargeback.currency_code)],
    ["Sebep", escape(REASONS[chargeback.reason] ?? chargeback.reason)],
    ["Belge son tarihi", date(chargeback.due_at)],
    ["Kayıt tarihi", date(chargeback.created_at)],
  ])}
<h2>Sipariş</h2>${rows([
    ["Sipariş numarası", `#${escape(order.display_id)}`],
    ["Sipariş tarihi", date(order.created_at)],
    ["E-posta", escape(order.email ?? "—")],
    ["Kargo", lira(order.shipping_total, currency)],
    ["Toplam (KDV dahil)", lira(order.total, currency)],
  ])}
<table><tr><th>Ürün</th><th>Adet</th><th>Tutar</th></tr>${items}</table>
<h2>Teslimat adresi</h2>${rows([
    ["Alıcı", escape(`${address["first_name"] ?? ""} ${address["last_name"] ?? ""}`.trim() || "—")],
    [
      "Adres",
      escape([address["address_1"], address["address_2"]].filter(Boolean).join(", ") || "—"),
    ],
    [
      "İlçe / İl",
      escape([address["city"], address["province"]].filter(Boolean).join(" / ") || "—"),
    ],
    ["Posta kodu", escape(address["postal_code"] ?? "—")],
    ["Telefon", escape(address["phone"] ?? "—")],
  ])}
<h2>Ödeme (sağlayıcının kaydı)</h2>${
    payment?.available
      ? rows([
          ["İşlem numarası", escape(payment.reference ?? "—")],
          ["Tutar", payment.amount === null ? "—" : kurusText(payment.amount, currency)],
          ["Kart", escape(`${payment.card_brand ?? ""} •••• ${payment.card_last4 ?? ""}`.trim())],
          [
            "Taksit",
            escape(
              payment.installments && payment.installments > 1
                ? `${String(payment.installments)} taksit`
                : "Tek çekim"
            ),
          ],
          ["Test modu", payment.test_mode ? "Evet" : "Hayır"],
        ])
      : `<p class="note">Sağlayıcının kaydı şu an okunamadı${payment?.error_code ? ` (${escape(payment.error_code)})` : ""}; işlem numarası: ${escape(payment?.reference ?? "—")}.</p>`
  }
<h2>Kargo ve teslim</h2>${shipments}
<h2>İadeler</h2>${refunds}
<h2>Sözleşme onayı ve erişim kaydı</h2>
<p class="note">Mesafeli satış sözleşmesi ve ön bilgilendirme onaylarının kaydı ile alıcının IP adresi bu sürümde saklanmıyor; yasal metin onayları geldiğinde (F13) bu bölüm otomatik dolar.</p>
</body></html>`
}
