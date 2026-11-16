import { useEffect } from "react"
import { SVG_MIME } from "@/features/media/api/media"
import { FAVICON_MIME, isSvgIcon } from "@/features/settings/favicon"

/** The panel's own icon link, apart from any other a page may hold. */
const SELECTOR = 'link[rel="icon"][data-shop-icon]'

/**
 * The browser tab's icon: the shop's site icon (PNG or SVG) while it has
 * one, so the panel's tab looks like the shop's. Without one the link is
 * taken away and the browser shows its own default, as before.
 */
export function useDocumentIcon(url: string | null | undefined) {
  useEffect(() => {
    const head = document.head
    const current = head.querySelector<HTMLLinkElement>(SELECTOR)
    if (!url) {
      current?.remove()
      return
    }
    const link = current ?? document.createElement("link")
    link.rel = "icon"
    link.setAttribute("data-shop-icon", "")
    link.type = isSvgIcon(url) ? SVG_MIME : FAVICON_MIME
    link.href = url
    if (!current) {
      head.append(link)
    }
  }, [url])
}
