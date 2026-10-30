import { fromMedusaAmount } from "../money"

export interface EvidenceOrder {
  display_id: number
  created_at: string
  email: string | null
  currency_code: string
  total: number
  shipping_total: number
  items: { title: string; quantity: number; total: number }[]
  shipping_address: Record<string, string | null> | null
  fulfillments: {
    created_at: string
    shipped_at: string | null
    delivered_at: string | null
    tracking: string[]
  }[]
}

export interface EvidenceChargeback {
  id: string
  order_id: string
  payment_id: string
  provider: string
  provider_reference: string | null
  amount: number
  currency_code: string
  reason: string
  status: string
  due_at: Date | string | null
  created_at: Date | string
}

/** The disputed payment as its provider holds it; kuruş. */
export interface EvidencePayment {
  available: boolean
  reference: string | null
  error_code: string | null
  amount: number | null
  card_brand: string | null
  card_last4: string | null
  installments: number | null
  test_mode: boolean
}

/** The shopper's consent to the contracts and the copies kept with the order (F13.2). */
export interface EvidenceContracts {
  given_at: string
  ip: string | null
  copies: { title: string; version: number; html: string; html_hash: string; intact: boolean }[]
}

export interface EvidenceRefund {
  created_at: string
  reference: string
  amount: number
  status: string
}

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
th{width:38%;color:#444;font-weight:600}.note{color:#555;font-size:13px}code{font-size:12px;word-break:break-all}
section.contract{border:1px solid #ddd;border-radius:6px;padding:4px 16px;margin:16px 0}h3{font-size:15px}
@media print{body{margin:0}section.contract{break-before:page}}`

function paymentSection(payment: EvidencePayment | null, currency: string): string {
  if (!payment?.available) {
    return `<p class="note">Sağlayıcının kaydı şu an okunamadı${payment?.error_code ? ` (${escape(payment.error_code)})` : ""}; işlem numarası: ${escape(payment?.reference ?? "—")}.</p>`
  }
  return rows([
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
}

function shipmentsSection(order: EvidenceOrder): string {
  return order.fulfillments.length
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
}

function refundsSection(refunds: readonly EvidenceRefund[], currency: string): string {
  return refunds.length
    ? rows(
        refunds.map((refund) => [
          `${date(refund.created_at)} (${refund.reference})`,
          `${kurusText(refund.amount, currency)} · ${escape(refund.status)}`,
        ])
      )
    : `<p class="note">Bu sipariş için iade yapılmadı.</p>`
}

/**
 * When and from where the contracts were accepted, and each copy as the
 * order made it. A copy that no longer matches its hash is named, not shown.
 */
function contractsSection(contracts: EvidenceContracts | null): string {
  if (!contracts) {
    return `<p class="note">Bu sipariş verilirken mağazanın yayında sözleşme metni yoktu; onay kaydı tutulmadı.</p>`
  }
  const summary = rows([
    ["Onay zamanı", date(contracts.given_at)],
    ["Alıcının IP adresi", escape(contracts.ip ?? "—")],
    ...contracts.copies.map((copy): [string, string] => [
      `${copy.title} (sürüm ${String(copy.version)})`,
      `SHA-256 <code>${escape(copy.html_hash)}</code>${copy.intact ? "" : " · özet tutmuyor"}`,
    ]),
  ])
  const copies = contracts.copies
    .filter((copy) => copy.intact)
    .map((copy) => `<section class="contract"><h3>${escape(copy.title)}</h3>${copy.html}</section>`)
  return summary + copies.join("")
}

function addressSection(address: Record<string, string | null>): string {
  return rows([
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
  ])
}

export function renderEvidence(input: {
  chargeback: EvidenceChargeback
  order: EvidenceOrder
  payment: EvidencePayment | null
  refunds: readonly EvidenceRefund[]
  contracts: EvidenceContracts | null
  generatedAt: Date
}): string {
  const { chargeback, order } = input
  const currency = order.currency_code
  const items = order.items
    .map(
      (item) =>
        `<tr><td>${escape(item.title)}</td><td>${escape(item.quantity)}</td><td>${lira(item.total, currency)}</td></tr>`
    )
    .join("")
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
<h2>Teslimat adresi</h2>${addressSection(order.shipping_address ?? {})}
<h2>Ödeme (sağlayıcının kaydı)</h2>${paymentSection(input.payment, currency)}
<h2>Kargo ve teslim</h2>${shipmentsSection(order)}
<h2>İadeler</h2>${refundsSection(input.refunds, currency)}
<h2>Sözleşme onayı ve erişim kaydı</h2>${contractsSection(input.contracts)}
</body></html>`
}
