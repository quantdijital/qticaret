import { useCallback, useState } from "react"
import { DEVICES, frameDocument } from "./frame-document"
import type { PreviewDevice } from "./frame-document"

/** The box's width, measured as it is laid out (before it is painted) and when it changes. */
function useWidth() {
  const [width, setWidth] = useState(0)
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return undefined
    }
    const measure = () => {
      setWidth(node.clientWidth)
    }
    measure()
    if (typeof ResizeObserver === "undefined") {
      return undefined
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])
  return [width, ref] as const
}

/**
 * The rendered e-mail at a device's width, scaled down to the card when
 * the card is narrower, and never taller than the screen leaves room for
 * (the column beside the editor follows the scroll). The frame runs no
 * script, sends no form and has no origin of its own (`sandbox=""`).
 */
export function EmailFrame({
  html,
  device,
  title,
}: {
  html: string
  device: PreviewDevice
  title: string
}) {
  const [width, ref] = useWidth()
  const size = DEVICES[device]
  const scale = width > 0 ? Math.min(1, width / size.width) : 1
  const height = size.height * scale
  return (
    <div ref={ref} className="flex w-full justify-center">
      <div
        data-device={device}
        className="overflow-hidden rounded-md border bg-white"
        style={{
          width: size.width * scale,
          height: `max(16rem, min(${String(height)}px, 100dvh - 32rem))`,
        }}
      >
        <iframe
          title={title}
          sandbox=""
          srcDoc={frameDocument(html)}
          className="block origin-top-left border-0"
          style={{
            width: size.width,
            // Filling the box once scaled: the e-mail scrolls inside it
            height: `calc(100% / ${String(scale)})`,
            transform: `scale(${String(scale)})`,
          }}
        />
      </div>
    </div>
  )
}
