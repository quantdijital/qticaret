import { useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { fitPreview, useRoom } from "@/features/storefront/editor/preview-fit"
import type { DesignCard } from "./api"
import { designPreviewQuery, pictureAddress } from "./design-preview"
import { DesignThumb } from "./design-thumb"
import { useSeen } from "./use-seen"

/**
 * A saved look's card picture (adr/0064): the storefront's own home page
 * with this look's sections and theme, drawn at a laptop's width and scaled
 * down to the card. Asked for only once the card comes near the screen;
 * the sketch drawn from its summary stands until the page has loaded, and
 * stays when no link comes (no storefront address known, the request
 * failed). The frame is a picture: no scripts (`sandbox`), no pointer, no
 * focus, hidden from screen readers (the card names the look).
 */
export function DesignFrame({ design }: { design: DesignCard }) {
  const room = useRef<HTMLDivElement>(null)
  const seen = useSeen(room)
  const size = useRoom(room)
  const preview = useQuery({ ...designPreviewQuery(design), enabled: seen })
  const address = preview.data ? pictureAddress(preview.data) : null
  const [loaded, setLoaded] = useState<string | null>(null)
  const fit = fitPreview("desktop", size)
  return (
    <div
      ref={room}
      data-design-frame=""
      className="relative aspect-[16/10] w-full overflow-hidden rounded-md border bg-muted"
    >
      <DesignThumb
        summary={design.summary}
        className={cn(
          "absolute inset-0 rounded-none border-0 transition-opacity",
          loaded === address && address ? "opacity-0" : "opacity-100"
        )}
      />
      {address && size.width > 0 ? (
        <iframe
          key={address}
          src={address}
          title=""
          aria-hidden
          tabIndex={-1}
          loading="lazy"
          referrerPolicy="no-referrer"
          // Fonts and pictures from the storefront's own origin, but no script runs
          sandbox="allow-same-origin"
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-white"
          style={{
            width: fit.width,
            height: fit.height,
            transform: `scale(${String(fit.scale)})`,
            opacity: loaded === address ? 1 : 0,
          }}
          onLoad={() => {
            setLoaded(address)
          }}
        />
      ) : null}
    </div>
  )
}
