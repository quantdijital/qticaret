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
      rows: {
        title: string
        detail: string | null
        quantity: number
        total: string
        /** Said under the line, smaller: its add-on picks (adr/0052 §9). */
        lines?: string[]
      }[]
    }
  | { kind: "summary"; rows: { label: string; value: string; strong?: boolean }[] }
  | { kind: "details"; title: string; lines: string[] }
  | { kind: "note"; text: string }
  // A campaign's body (adr/0050 §4), from its content document
  | { kind: "heading"; text: string }
  | { kind: "rich"; runs: EmailRun[] }
  | { kind: "list"; ordered: boolean; items: EmailRun[][] }
  | { kind: "image"; src: string; alt: string }
  | { kind: "products"; cards: EmailProductCard[] }

/** A stretch of text with its emphasis, and the link it is part of. */
export interface EmailRun {
  text: string
  bold?: boolean
  italic?: boolean
  href?: string | null
}

/** A product as a campaign shows it: its price read at send time (adr/0050 §4). */
export interface EmailProductCard {
  title: string
  url: string | null
  image: string | null
  price: string | null
  /** The price struck through, where the 30-day rule allows it. */
  before: string | null
}

export interface EmailBody {
  subject: string
  /** The line mail clients show after the subject. */
  preheader: string
  /** The message's title; empty for none (a campaign's body has its own). */
  heading: string
  blocks: EmailBlock[]
  /** Why the recipient gets it (transactional) or how to stop it (commercial). */
  footer: string
  /** A commercial message's one-click way out (adr/0038 §1); shown under the footer. */
  unsubscribe?: { label: string; url: string | null } | null
}

const e = (value: string): string => escapeXml(value)

// A shop's own text keeps its line breaks (adr/0036 Ek 2026-11-10); escaped first
const lines = (value: string): string => e(value).replace(/\r?\n/g, "<br>")

const linkable = (url: string | null): url is string =>
  url !== null && /^https?:\/\/[^\s"<>]+$/.test(url)

const FONT = "font-family:Arial,Helvetica,sans-serif;"
const MUTED = "#6b7280"
const BODY_TEXT = `${FONT}font-size:15px;line-height:22px;color:#111827`

function runsHtml(runs: readonly EmailRun[], color: string): string {
  return runs
    .map((run) => {
      let html = e(run.text).replace(/\n/g, "<br>")
      if (run.italic) {
        html = `<em>${html}</em>`
      }
      if (run.bold) {
        html = `<strong>${html}</strong>`
      }
      return linkable(run.href ?? null)
        ? `<a href="${e(run.href ?? "")}" style="color:${color};text-decoration:underline">${html}</a>`
        : html
    })
    .join("")
}

const runsText = (runs: readonly EmailRun[]): string =>
  runs
    .map((run) => {
      const href = run.href ?? null
      return linkable(href) && href !== run.text ? `${run.text} (${href})` : run.text
    })
    .join("")

function productCell(card: EmailProductCard, color: string): string {
  const link = (inner: string) =>
    linkable(card.url)
      ? `<a href="${e(card.url)}" style="color:#111827;text-decoration:none">${inner}</a>`
      : inner
  const image = linkable(card.image)
    ? link(
        `<img src="${e(card.image)}" alt="${e(card.title)}" width="260" style="display:block;width:100%;max-width:260px;height:auto;border:0;border-radius:6px;margin:0 0 8px">`
      )
    : ""
  const before = card.before
    ? ` <s style="color:${MUTED};font-weight:normal">${e(card.before)}</s>`
    : ""
  const price = card.price
    ? `<br><span style="font-weight:bold;color:${color}">${e(card.price)}</span>${before}`
    : ""
  return `<td width="50%" valign="top" style="${FONT}font-size:14px;line-height:20px;padding:0 8px 16px;color:#111827">${image}${link(e(card.title))}${price}</td>`
}

function productsHtml(cards: readonly EmailProductCard[], color: string): string {
  const rows: string[] = []
  for (let index = 0; index < cards.length; index += 2) {
    const pair = cards.slice(index, index + 2)
    rows.push(
      `<tr>${pair.map((card) => productCell(card, color)).join("")}${pair.length === 1 ? "<td></td>" : ""}</tr>`
    )
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -8px">${rows.join("")}</table>`
}

/** The blocks only a campaign's body has (adr/0050 §4). */
type CampaignBlock = Extract<
  EmailBlock,
  { kind: "heading" | "rich" | "list" | "image" | "products" }
>

function campaignBlockHtml(block: CampaignBlock, color: string): string {
  switch (block.kind) {
    case "heading":
      return `<h2 style="${FONT}font-size:18px;line-height:26px;margin:0 0 12px;color:#111827">${e(block.text)}</h2>`
    case "rich":
      return `<p style="${BODY_TEXT};margin:0 0 16px">${runsHtml(block.runs, color)}</p>`
    case "list": {
      const tag = block.ordered ? "ol" : "ul"
      return `<${tag} style="${BODY_TEXT};margin:0 0 16px;padding-left:24px">${block.items
        .map((item) => `<li style="margin:0 0 4px">${runsHtml(item, color)}</li>`)
        .join("")}</${tag}>`
    }
    case "image":
      return linkable(block.src)
        ? `<p style="margin:0 0 16px"><img src="${e(block.src)}" alt="${e(block.alt)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:6px"></p>`
        : ""
    case "products":
      return productsHtml(block.cards, color)
  }
}

function campaignBlockText(block: CampaignBlock): string {
  switch (block.kind) {
    case "heading":
      return block.text
    case "rich":
      return runsText(block.runs)
    case "list":
      return block.items
        .map((item, index) => `${block.ordered ? `${String(index + 1)}.` : "•"} ${runsText(item)}`)
        .join("\n")
    case "image":
      return ""
    case "products":
      return block.cards
        .map((card) =>
          [`${card.title}${card.price ? `: ${card.price}` : ""}`, card.url ?? ""]
            .filter(Boolean)
            .join("\n")
        )
        .join("\n\n")
  }
}

function blockHtml(block: EmailBlock, color: string): string {
  switch (block.kind) {
    case "heading":
    case "rich":
    case "list":
    case "image":
    case "products":
      return campaignBlockHtml(block, color)
    case "paragraph":
      return `<p style="${FONT}font-size:15px;line-height:22px;margin:0 0 16px;color:#111827">${lines(block.text)}</p>`
    case "note":
      return `<p style="${FONT}font-size:13px;line-height:20px;margin:0 0 16px;color:${MUTED}">${lines(block.text)}</p>`
    case "button":
      return linkable(block.url)
        ? `<p style="margin:8px 0 24px"><a href="${e(block.url)}" style="${FONT}display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 20px;border-radius:6px">${e(block.label)}</a></p>`
        : ""
    case "items":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">${block.rows
        .map(
          (row) =>
            `<tr><td style="${FONT}font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827">${e(row.title)}${[row.detail, ...(row.lines ?? [])].map((line) => (line ? `<br><span style="color:${MUTED};font-size:13px">${e(line)}</span>` : "")).join("")}</td><td style="${FONT}font-size:14px;padding:8px;border-bottom:1px solid #e5e7eb;color:${MUTED};text-align:center;white-space:nowrap">× ${String(row.quantity)}</td><td style="${FONT}font-size:14px;padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;text-align:right;white-space:nowrap">${e(row.total)}</td></tr>`
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
    case "heading":
    case "rich":
    case "list":
    case "image":
    case "products":
      return campaignBlockText(block)
    case "paragraph":
    case "note":
      return block.text
    case "button":
      return linkable(block.url) ? `${block.label}: ${block.url}` : ""
    case "items":
      return block.rows
        .map(
          (row) =>
            `${String(row.quantity)} × ${row.title}${row.detail ? ` (${row.detail})` : ""}: ${row.total}${(row.lines ?? []).map((line) => `\n  ${line}`).join("")}`
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
  const leave =
    body.unsubscribe && linkable(body.unsubscribe.url)
      ? { label: body.unsubscribe.label, url: body.unsubscribe.url }
      : null
  const html = [
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(body.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:#f3f4f6">`,
    `<div style="display:none;max-height:0;overflow:hidden">${e(body.preheader)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">`,
    `<tr><td style="background:${color};padding:16px 24px">${mark}</td></tr>`,
    `<tr><td style="padding:24px">${body.heading ? `<h1 style="${FONT}font-size:20px;line-height:28px;margin:0 0 16px;color:#111827">${e(body.heading)}</h1>` : ""}`,
    body.blocks.map((block) => blockHtml(block, color)).join(""),
    `</td></tr>`,
    `<tr><td style="padding:16px 24px;border-top:1px solid #e5e7eb"><p style="${FONT}font-size:12px;line-height:18px;margin:0;color:${MUTED}">${e(body.footer)}${contact ? `<br>${e(brand.shopName)} · ${e(contact)}` : ""}${leave ? `<br><a href="${e(leave.url)}" style="color:${MUTED};text-decoration:underline">${e(leave.label)}</a>` : ""}</p></td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("")
  const text = [
    ...(body.heading ? [body.heading] : []),
    ...body.blocks.map(blockText).filter((part) => part !== ""),
    "—",
    body.footer,
    contact ? `${brand.shopName} · ${contact}` : brand.shopName,
    ...(leave ? [`${leave.label}: ${leave.url}`] : []),
  ].join("\n\n")
  return { subject: body.subject, html, text }
}
