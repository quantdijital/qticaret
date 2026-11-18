import type { MessageLocale } from "../../errors/messages"
import type { InvoicePayment } from "../types"

/**
 * What BirFatura's panel shows the shop for our services (adr/0072 §5):
 * the order states and payment methods it maps, and the messages of the
 * update services. Worded on the server, as the notifications are
 * (lib/notifications/messages.ts); one language until F19.
 */

export const BIRFATURA_LOCALE: MessageLocale = "tr"

interface BirfaturaTexts {
  statuses: Readonly<Record<"ready" | "invoiced" | "cancelled", string>>
  payments: Readonly<Record<InvoicePayment, string>>
  messages: Readonly<Record<BirfaturaMessage, string>>
}

export type BirfaturaMessage =
  | "invoice_recorded"
  | "invoice_number_missing"
  | "invoice_unknown_order"
  | "invoice_refused"
  | "invoice_pdf_failed"
  | "cargo_ignored"
  | "range_invalid"
  | "failed"

export const BIRFATURA_TEXTS: Readonly<Record<MessageLocale, BirfaturaTexts>> = {
  tr: {
    statuses: { ready: "Faturaya hazır", invoiced: "Faturalandı", cancelled: "İptal edildi" },
    payments: {
      card: "Kredi/Banka Kartı",
      bank_transfer: "EFT/Havale",
      cash_on_delivery: "Kapıda Ödeme",
      gift_card: "Hediye Kartı",
      other: "Diğer",
    },
    messages: {
      invoice_recorded: "Fatura bilgisi kaydedildi.",
      invoice_number_missing: "Fatura bağlantısı alındı; fatura numarası mağazada girilecek.",
      invoice_unknown_order: "Sipariş bulunamadı.",
      invoice_refused: "Fatura bilgisi kaydedilemedi; mağaza panelinde inceleniyor.",
      invoice_pdf_failed: "Fatura numarası kaydedildi; PDF indirilemedi, yeniden gönderin.",
      cargo_ignored: "Kargo bilgisi alındı.",
      range_invalid: "Tarih aralığı geçersiz: başlangıç bitişten önce, en çok 31 gün.",
      failed: "İşlem tamamlanamadı.",
    },
  },
  en: {
    statuses: { ready: "Ready to invoice", invoiced: "Invoiced", cancelled: "Cancelled" },
    payments: {
      card: "Credit/Debit Card",
      bank_transfer: "Bank Transfer",
      cash_on_delivery: "Cash on Delivery",
      gift_card: "Gift Card",
      other: "Other",
    },
    messages: {
      invoice_recorded: "Invoice details recorded.",
      invoice_number_missing: "Invoice link received; the shop will enter the invoice number.",
      invoice_unknown_order: "Order not found.",
      invoice_refused: "Invoice details could not be recorded; the shop is looking into it.",
      invoice_pdf_failed:
        "Invoice number recorded; the PDF could not be downloaded, send it again.",
      cargo_ignored: "Shipping details received.",
      range_invalid: "The date range is invalid: start before end, 31 days at most.",
      failed: "The request could not be completed.",
    },
  },
}

export const birfaturaTexts = (locale: MessageLocale = BIRFATURA_LOCALE): BirfaturaTexts =>
  BIRFATURA_TEXTS[locale]
