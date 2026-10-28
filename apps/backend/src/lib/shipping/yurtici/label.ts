import { escapeXml } from "../../clients/xml"
import { code128Svg } from "../code128"
import type { Receiver } from "../receiver"

/**
 * The parcel's label for Yurtiçi (adr/0035): Yurtiçi gives none, its
 * branch scans the cargo key on the box. A page to print on a 100×150 mm
 * label: the key as a Code 128 barcode, the receiver, the order and what
 * the courier collects. Every value is escaped and the page runs nothing
 * (its policy allows inline style only). Turkish text: the label is for
 * a Turkish carrier's branch.
 */

export interface YurticiLabelInput {
  cargoKey: string
  orderNumber: string
  receiver: Receiver
  desi: number
  kg: number
  /** Kuruş the courier collects at the door; null when paid already. */
  cashOnDelivery: number | null
  test: boolean
}

const lira = (amount: number): string =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(amount / 100)

const measure = (value: number): string =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)

const STYLE = [
  "@page{size:100mm 150mm;margin:0}",
  "*{box-sizing:border-box}",
  "body{margin:0;font:12pt/1.35 Arial,Helvetica,sans-serif;color:#000;background:#fff}",
  ".label{width:100mm;height:150mm;padding:5mm;display:flex;flex-direction:column;gap:3mm}",
  ".head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.6mm solid #000;padding-bottom:2mm}",
  ".carrier{font-size:16pt;font-weight:700}",
  ".test{font-weight:700;border:.5mm solid #000;padding:0 2mm}",
  ".code{text-align:center}",
  ".key{font:700 14pt/1 monospace;letter-spacing:.5mm;margin-top:1mm}",
  ".title{font-size:9pt;text-transform:uppercase;letter-spacing:.3mm}",
  ".name{font-size:15pt;font-weight:700}",
  ".cod{border:.6mm solid #000;padding:2mm;font-size:14pt;font-weight:700;text-align:center}",
  ".meta{display:flex;justify-content:space-between;border-top:.3mm solid #000;padding-top:2mm;margin-top:auto}",
].join("")

export function yurticiLabelHtml(input: YurticiLabelInput): string {
  const text = (value: string) => escapeXml(value)
  const { receiver } = input
  const cod =
    input.cashOnDelivery !== null && input.cashOnDelivery > 0
      ? `<div class="cod">KAPIDA TAHSİLAT: ${text(lira(input.cashOnDelivery))}</div>`
      : ""
  return [
    "<!doctype html>",
    '<html lang="tr"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    `<title>Yurtiçi Kargo ${text(input.cargoKey)}</title>`,
    `<style>${STYLE}</style></head><body><main class="label">`,
    '<div class="head"><span class="carrier">Yurtiçi Kargo</span>',
    input.test ? '<span class="test">TEST</span>' : "",
    "</div>",
    `<div class="code">${code128Svg(input.cargoKey)}<div class="key">${text(input.cargoKey)}</div></div>`,
    '<div><div class="title">Alıcı</div>',
    `<div class="name">${text(receiver.name)}</div>`,
    `<div>${text(receiver.address)}</div>`,
    `<div><strong>${text(receiver.town)} / ${text(receiver.city)}</strong></div>`,
    `<div>${text(receiver.phone)}</div></div>`,
    cod,
    '<div class="meta">',
    `<span>Sipariş ${text(input.orderNumber)}</span>`,
    `<span>${text(measure(input.desi))} desi · ${text(measure(input.kg))} kg · 1/1</span>`,
    "</div></main></body></html>",
  ].join("")
}
