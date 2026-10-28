import type { MedusaResponse } from "@medusajs/framework/http"
import { escapeXml } from "../../lib/clients/xml"

// The page runs nothing and loads nothing; its one form posts back here
const PAGE_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"

/** A confirmation button posting back to the page's own address (token included). */
export const confirmForm = (token: string, label: string): string =>
  `<form method="post" action="?t=${escapeXml(encodeURIComponent(token))}"><button type="submit" style="padding:10px 16px;font-size:15px">${escapeXml(label)}</button></form>`

/**
 * A one-message page a link in an e-mail opens (unsubscribe, a stock
 * alert's confirmation): the shop's name, a title, text the caller made
 * safe, nothing loaded or run, not indexed, sending no referrer.
 */
export function simplePage(
  res: MedusaResponse,
  status: number,
  page: { shop: string; title: string; body: string }
) {
  res.setHeader("Content-Security-Policy", PAGE_POLICY)
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res
    .status(status)
    .send(
      `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeXml(page.title)}</title></head>` +
        `<body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#111827">` +
        `<p style="color:#6b7280;margin:0 0 8px">${escapeXml(page.shop)}</p><h1 style="font-size:20px">${escapeXml(page.title)}</h1>${page.body}</body></html>`
    )
}
