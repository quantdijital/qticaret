/**
 * What the shop's "Stok yetersiz sipariş" e-mail says (adr/0026 Ek
 * 2026-11-06). Part of the message catalog (`texts.ts`).
 */
export const STOCK_SHORT_TEXTS: Readonly<Record<string, string>> = {
  "staff_short.subject": "Stok yetersiz sipariş #{{number}}",
  "staff_short.preheader": "Ödemesi alındı; eksik ürünleri üretin, tedarik edin ya da iade edin.",
  "staff_short.heading": "#{{number}} için stok yetersiz",
  "staff_short.intro":
    "Bu siparişin ödemesi alındı, ancak bazı ürünlerin stoğu sipariş anında başka siparişlere ayrılmıştı. Sipariş yine de açıldı. Eksik ürünleri üretin ya da tedarik edin; edemeyecekseniz siparişi iptal edip ödemeyi iade edin.",
  "staff_short.lines": "Eksik ürünler",
  "staff_short.line": "{{title}}: {{short}} adet eksik (siparişte {{quantity}})",
  "staff_short.button": "Siparişi aç",
}
