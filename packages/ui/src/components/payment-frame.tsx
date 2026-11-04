"use client"

import { useEffect, useRef } from "react"
import { cn } from "@qticaret/ui/lib/utils"
import {
  FRAME_DEFAULT_HEIGHT,
  RESIZER_INIT,
  RESIZER_RESIZE,
  frameHeightOf,
  frameOriginOf,
} from "@qticaret/ui/lib/frame-resizer"

interface PaymentFrameProps {
  /** The provider's hosted form (PayTR's `/odeme/guvenli/<token>`). */
  src: string
  title: string
  className?: string
}

/**
 * A card provider's hosted form, as tall as its page (the host side of
 * iframe-resizer, `lib/frame-resizer.ts`): no scrolling inside the frame
 * on a phone, no empty space under the form on a desktop. Until a page
 * says its height, and for one that says none (a bank's 3-D Secure page),
 * the frame keeps the default height; the frame still scrolls then.
 *
 * The height is written through the element's style object, never as a
 * `style` attribute: the storefront's CSP refuses inline style attributes.
 */
export function PaymentFrame({ src, title, className }: PaymentFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = ref.current
    const origin = frameOriginOf(src, window.location.href)
    if (!frame || !origin) {
      return
    }
    const setHeight = (height: number) => {
      frame.style.height = `${String(height)}px`
    }
    // To the provider's origin only: a page of another (the bank's) gets nothing
    const post = (message: string) => {
      frame.contentWindow?.postMessage(message, origin)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) {
        return
      }
      const height = frameHeightOf(event.data, event.origin, origin)
      if (height !== null) {
        setHeight(height)
      }
    }
    // Each page in the frame (the form, the bank's page, the result) starts over
    const onLoad = () => {
      setHeight(FRAME_DEFAULT_HEIGHT)
      post(RESIZER_INIT)
    }
    let width = frame.clientWidth
    const observer = new ResizeObserver(() => {
      if (frame.clientWidth !== width) {
        width = frame.clientWidth
        post(RESIZER_RESIZE)
      }
    })
    window.addEventListener("message", onMessage)
    frame.addEventListener("load", onLoad)
    observer.observe(frame)
    // A page loaded before this ran is waiting for it
    post(RESIZER_INIT)
    return () => {
      window.removeEventListener("message", onMessage)
      frame.removeEventListener("load", onLoad)
      observer.disconnect()
    }
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      className={cn("h-[640px] w-full border-0", className)}
      referrerPolicy="origin"
    />
  )
}
