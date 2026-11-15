import "server-only"
import { NextResponse } from "next/server"
import { storefrontEnv } from "../env"
import { escapeHtml } from "../security/html"
import { scriptSafeJson } from "../seo/JsonLd"

/**
 * The card provider's return (D7). A provider may load our return address
 * inside its own form, which sits in a frame on `/odeme/kart`: that load
 * only lifts the address to the whole window, where it is answered.
 */
export function framed(request: Request): boolean {
  return request.headers.get("sec-fetch-dest") === "iframe"
}

export function breakOut(request: Request, label: string): Response {
  // Set by the proxy for this response, never by the visitor
  const nonce = escapeHtml(request.headers.get("x-nonce") ?? "")
  const url = new URL(request.url)
  // The same address on our own origin: `//host` would be another site's
  const path = /^\/(?![/\\])/.test(url.pathname) ? url.pathname + url.search : "/"
  const text = escapeHtml(label)
  // Every piece is escaped for where it lands: the script gets a script-safe
  // string, the link a quoted attribute, the title and link text plain text
  // (tested in __tests__/return.spec.ts); the rule does not know these escapers
  // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format
  const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>${text}</title><script nonce="${nonce}">window.top.location.href=${scriptSafeJson(path)}</script><p><a href="${escapeHtml(path)}" target="_top">${text}</a></p></html>`
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

/** A 303 to a path of ours: the browser follows with a GET, whatever the provider posted. */
export const seeOther = (path: string) =>
  NextResponse.redirect(new URL(path, storefrontEnv().STOREFRONT_ORIGIN), 303)
