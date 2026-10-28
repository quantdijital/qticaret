import { escapeXml } from "../../clients/xml"
import type { Brand, EmailContent } from "./types"

/**
 * The e-mail every template fills (adr/0036): a table layout with inline
 * styles that mail clients keep, the shop's logo or name on its colour,
 * and a plain-text twin. Every value is escaped here; templates pass plain
 * strings. Links are drawn only for http(s) addresses.
 */

export type EmailBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "button"; label: string; url: string | null }
  | {
      kind: "items"
      rows: { title: string; detail: string | null; quantity: number; total: string }[]
    }
  | { kind: "summary"; rows: { label: string; value: string; strong?: boolean }[] }
  | { kind: "details"; title: string; lines: string[] }
  | { kind: "note"; text: string }

export interface EmailBody {
  subject: string
  /** The line mail clients show after the subject. */
  preheader: string
  heading: string
  blocks: EmailBlock[]
  /** Why the recipient gets it (transactional) or how to stop it (commercial). */
  footer: string
}

const e = (value: string): string => escapeXml(value)

const linkable = (url: string | null): url is string =>
  url !== null && /^https?:\/\/[^\s"<>]+$/.test(url)

const FONT = "font-family:Arial,Helvetica,sans-serif;"
const MUTED = "#6b7280"

function blockHtml(block: EmailBlock, color: string): string {
  switch (block.kind) {
    case "paragraph":
      return `<p style="${FONT}font-size:15px;line-height:22px;margin:0 0 16px;color:#111827">${e(block.text)}</p>`
    case "note":
      return `<p style="${FONT}font-size:13px;line-height:20px;margin:0 0 16px;color:${MUTED}">${e(block.text)}</p>`
    case "button":
      return linkable(block.url)
        ? `<p style="margin:8px 0 24px"><a href="${e(block.url)}" style="${FONT}display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 20px;border-radius:6px">${e(block.label)}</a></p>`
        : ""
    case "items":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">${block.rows
        .map(
          (row) =>
            `<tr><td style="${FONT}font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827">${e(row.title)}${row.detail ? `<br><span style="color:${MUTED};font-size:13px">${e(row.detail)}</span>` : ""}</td><td style="${FONT}font-size:14px;padding:8px;border-bottom:1px solid #e5e7eb;color:${MUTED};text-align:center;white-space:nowrap">× ${String(row.quantity)}</td><td style="${FONT}font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;text-align:right;white-space:nowrap">${e(row.total)}</td></tr>`
        )
        .join("")}</table>`
    case "summary":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">${block.rows
        .map(
          (row) =>
            `<tr><td style="${FONT}font-size:14px;padding:4px 0;color:${row.strong ? "#111827" : MUTED};${row.strong ? "font-weight:bold;" : ""}">${e(row.label)}</td><td style="${FONT}font-size:14px;padding:4px 0;text-align:right;color:#111827;${row.strong ? "font-weight:bold;" : ""}">${e(row.value)}</td></tr>`
        )
        .join("")}</table>`
    case "details":
      return `<div style="${FONT}font-size:14px;line-height:21px;margin:0 0 16px;padding:12px 16px;background:#f9fafb;border-radius:6px;color:#111827"><strong>${e(block.title)}</strong><br>${block.lines.map(e).join("<br>")}</div>`
  }
}

function blockText(block: EmailBlock): string {
  switch (block.kind) {
    case "paragraph":
    case "note":
      return block.text
    case "button":
      return linkable(block.url) ? `${block.label}: ${block.url}` : ""
    case "items":
      return block.rows
        .map(
          (row) =>
            `${String(row.quantity)} × ${row.title}${row.detail ? ` (${row.detail})` : ""}: ${row.total}`
        )
        .join("\n")
    case "summary":
      return block.rows.map((row) => `${row.label}: ${row.value}`).join("\n")
    case "details":
      return [block.title, ...block.lines].join("\n")
  }
}

export function renderEmail(brand: Brand, body: EmailBody): EmailContent {
  const color = /^#[0-9a-f]{6}$/i.test(brand.color) ? brand.color : "#111827"
  const mark = linkable(brand.logoUrl)
    ? `<img src="${e(brand.logoUrl)}" alt="${e(brand.shopName)}" height="32" style="display:block;height:32px;border:0">`
    : `<span style="${FONT}font-size:18px;font-weight:bold;color:#ffffff">${e(brand.shopName)}</span>`
  const contact = [brand.contactEmail, brand.contactPhone].filter(Boolean).join(" · ")
  const html = [
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(body.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:#f3f4f6">`,
    `<div style="display:none;max-height:0;overflow:hidden">${e(body.preheader)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">`,
    `<tr><td style="background:${color};padding:16px 24px">${mark}</td></tr>`,
    `<tr><td style="padding:24px"><h1 style="${FONT}font-size:20px;line-height:28px;margin:0 0 16px;color:#111827">${e(body.heading)}</h1>`,
    body.blocks.map((block) => blockHtml(block, color)).join(""),
    `</td></tr>`,
    `<tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb"><p style="${FONT}font-size:12px;line-height:18px;margin:0;color:${MUTED}">${e(body.footer)}${contact ? `<br>${e(brand.shopName)} · ${e(contact)}` : ""}</p></td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("")
  const text = [
    body.heading,
    ...body.blocks.map(blockText).filter((part) => part !== ""),
    "—",
    body.footer,
    contact ? `${brand.shopName} · ${contact}` : brand.shopName,
  ].join("\n\n")
  return { subject: body.subject, html, text }
}
