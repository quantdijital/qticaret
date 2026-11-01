import "server-only"
import { headers } from "next/headers"

/** The address `proxy.ts` saw, query included (adr/0046 §4). */
export async function requestedUrl(): Promise<URL> {
  const path = (await headers()).get("x-qt-url") ?? "/"
  return new URL(path.startsWith("/") ? path : "/", "http://storefront.invalid")
}
