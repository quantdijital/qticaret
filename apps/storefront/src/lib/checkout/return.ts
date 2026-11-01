import "server-only"
import { NextResponse } from "next/server"
import { storefrontEnv } from "../env"

/**
 * The card provider's return (D7). A provider may load our return address
 * inside its own form, which sits in a frame on `/odeme/kart`: that load
 * only lifts the address to the whole window, where it is answered.
 */
export function framed(request: Request): boolean {
  return request.headers.get("sec-fetch-dest") === "iframe"
}

export function breakOut(request: Request, label: string): Response {
  const nonce = request.headers.get("x-nonce") ?? ""
  const target = JSON.stringify(new URL(request.url).pathname + new URL(request.url).search)
  const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><title>${label}</title><script nonce="${nonce}">window.top.location.href=${target}</script><p><a href=${target} target="_top">${label}</a></p></html>`
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

/** A 303 to a path of ours: the browser follows with a GET, whatever the provider posted. */
export const seeOther = (path: string) =>
  NextResponse.redirect(new URL(path, storefrontEnv().STOREFRONT_ORIGIN), 303)
