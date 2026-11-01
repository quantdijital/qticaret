import "server-only"
import { cookies, headers } from "next/headers"
import { storefrontEnv } from "../env"
import { cookieName } from "../security/cookies"
import { storeCall } from "../store-api/server"

/**
 * The cookie banner's answer and the identifiers the shopper allowed, put
 * on the cart as the order is placed (F10.9, adr/0038 §4): the backend
 * then sends the purchase to GA4 and Meta only within that consent. The
 * visitor's kept answer (`qt_vid`) decides; the browser's identifiers
 * (`_ga`, `_fbp`, `_fbc`) go only if a tag set them; the shopper's own
 * user agent rides along (the backend keeps it only with marketing consent).
 */
const GA = /^GA\d\.\d\.(\d{1,12}\.\d{1,12})$/
const FBP = /^fb\.\d\.\d{10,16}\.\d{1,20}$/
const FBC = /^fb\.\d\.\d{10,16}\.[\w-]{1,500}$/
const VISITOR = /^[A-Za-z0-9_-]{32}$/

export async function recordTracking(cartId: string): Promise<void> {
  const [jar, incoming] = await Promise.all([cookies(), headers()])
  const visitorName = cookieName("qt_vid")
  const visitor = jar.get(visitorName)?.value
  if (!visitor || !VISITOR.test(visitor)) {
    // No answer kept: nothing allowed, nothing to send
    return
  }
  const ga = GA.exec(jar.get("_ga")?.value ?? "")?.[1]
  const fbp = jar.get("_fbp")?.value
  const fbc = jar.get("_fbc")?.value
  const agent = incoming.get("user-agent")
  await storeCall(`/store/carts/${cartId}/tracking`, {
    method: "POST",
    body: {
      ...(ga ? { ga_client_id: ga } : {}),
      ...(fbp && FBP.test(fbp) ? { fbp } : {}),
      ...(fbc && FBC.test(fbc) ? { fbc } : {}),
      page_url: `${storefrontEnv().STOREFRONT_ORIGIN}/odeme`,
    },
    headers: {
      cookie: `${visitorName}=${visitor}`,
      ...(agent ? { "user-agent": agent.slice(0, 512) } : {}),
    },
  })
}
