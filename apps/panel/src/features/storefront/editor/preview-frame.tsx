import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2, MonitorX } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { LAYOUT_KEY, fetchLayoutPreview } from "@/features/storefront/api/layout"
import { previewAddress } from "@/features/storefront/layout/preview-url"
import { errorText } from "@/lib/errors"
import { cn } from "@/lib/utils"

const V = "storefront.editor.preview"

export type Device = "desktop" | "mobile"

interface PreviewFrameProps {
  /** Grows with each saved draft (and each change made elsewhere): a new link is asked for. */
  round: number
  /** The draft has been saved at least once: there is something to show. */
  ready: boolean
  device: Device
  /** The page shown with the draft: a product's or category's path; null: the home page. */
  page: string | null
  /** Why the chosen page cannot be shown (no live product yet); shown in place of the frame. */
  missing: string | null
  /** The page to show is still being found (the first live product): the frame waits. */
  finding: boolean
}

/** A message in place of the storefront: why it does not show, and what to do. */
function PreviewMessage({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-3 self-center px-6 text-center">
      <MonitorX className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}

/**
 * The storefront itself, showing the draft (adr/0049): a signed link asked
 * for after each save, in a frame the storefront allows only the panel to
 * open. The last page stays on show while the next one loads.
 */
export function PreviewFrame({ round, ready, device, page, missing, finding }: PreviewFrameProps) {
  const { t } = useTranslation()
  const preview = useQuery({
    queryKey: [...LAYOUT_KEY, "preview", round],
    queryFn: fetchLayoutPreview,
    enabled: ready,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  })
  const address =
    preview.data && !missing && !finding ? previewAddress(preview.data, undefined, page) : null
  const [loaded, setLoaded] = useState<string | null>(null)
  // The spinner while a link is asked for, and while the page it opens loads
  const waiting =
    !missing &&
    !preview.isError &&
    (finding || (address ? loaded !== address || preview.isPlaceholderData : !preview.data))
  let content: ReactNode
  if (missing) {
    content = <PreviewMessage text={missing} />
  } else if (preview.isError) {
    content = (
      <PreviewMessage
        text={`${t(`${V}.failed`)} ${errorText(t, preview.error)}`}
        action={
          <Button variant="outline" size="sm" onClick={() => void preview.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    )
  } else if (preview.data && !address && !finding) {
    content = (
      <PreviewMessage
        text={t(`${V}.noHost`)}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/seo">{t(`${V}.noHostLink`)}</Link>
          </Button>
        }
      />
    )
  } else if (address) {
    content = (
      <iframe
        data-storefront-preview=""
        title={t(`${V}.frameTitle`)}
        src={address}
        // Its own scripts and storage; no forms sent, no taking over the panel's tab
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className={cn(
          "h-full min-h-0 max-w-full flex-1 border-0 bg-background",
          device === "mobile"
            ? "w-[390px] flex-none rounded-lg border shadow-card"
            : "w-full lg:rounded-md lg:border lg:shadow-card"
        )}
        onLoad={() => {
          setLoaded(address)
        }}
      />
    )
  } else {
    content = null
  }
  return (
    <div className="relative flex min-h-[36rem] min-w-0 flex-1 bg-muted lg:min-h-0 lg:p-4">
      <div className="flex min-w-0 flex-1 justify-center">{content}</div>
      {waiting ? (
        <div
          role="status"
          className="pointer-events-none absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-card"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t(address ? `${V}.refreshing` : `${V}.loading`)}
        </div>
      ) : null}
    </div>
  )
}
