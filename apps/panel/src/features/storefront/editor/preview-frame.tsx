import { Link } from "@tanstack/react-router"
import { Loader2, Monitor, MonitorX, Smartphone, Tablet } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { errorText } from "@/lib/errors"
import type { LivePreview } from "./bridge/use-live-preview"
import { DEVICES, fitPreview, useRoom } from "./preview-fit"
import type { Device } from "./preview-fit"

const V = "storefront.editor.preview"
const D = "storefront.editor.device"

const DEVICE_ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const

const PERCENT = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 })

interface PreviewFrameProps {
  /** What the frame opens: the live session's one address, or a signed link per save (adr/0065). */
  preview: LivePreview
  device: Device
  onDevice: (device: Device) => void
  /** Which product's or category's page shows the draft (their pages only). */
  sample: ReactNode
  /** Why the chosen page cannot be shown (no live product yet); shown in place of the frame. */
  missing: string | null
  /** The page to show is still being found (the first live product): the frame waits. */
  finding: boolean
  /** What the frame cannot show of what is asked (a hidden section, the live preview off). */
  notice?: string | null
  /** Said by a live region: the section just opened from the preview. */
  announce?: string | null
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

/** The preview's own bar: the sample page, the device's width, and the scale it is shown at. */
function PreviewBar({
  sample,
  device,
  onDevice,
  scale,
}: {
  sample: ReactNode
  device: Device
  onDevice: (device: Device) => void
  scale: number
}) {
  const { t } = useTranslation()
  const percent = PERCENT.format(scale)
  return (
    <div className="@container flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
      <div className="flex min-w-0 flex-1 items-center">{sample}</div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={t(`${D}.label`)}
        value={device}
        onValueChange={(next) => {
          if (next) {
            onDevice(next as Device)
          }
        }}
      >
        {DEVICES.map((each) => {
          const Icon = DEVICE_ICONS[each]
          return (
            <ToggleGroupItem
              key={each}
              value={each}
              aria-label={t(`${D}.${each}`)}
              title={t(`${D}.${each}`)}
            >
              <Icon />
              <span className="hidden @min-[34rem]:inline">{t(`${D}.${each}`)}</span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <span
        className="tabular w-11 shrink-0 text-right text-xs text-muted-foreground"
        title={t(`${V}.scaleHint`)}
      >
        <span className="sr-only">{t(`${V}.scale`)} </span>
        {percent}
      </span>
    </div>
  )
}

/**
 * The storefront itself, showing the draft (adr/0049): the live session's
 * one address, redrawn in place after each save (adr/0065), else a signed
 * link asked for after each save; in a frame the storefront allows only
 * the panel to open. It is drawn at the chosen device's width and scaled down as a
 * whole to the room it has, never cut off. The last page stays on show
 * while the next one loads.
 */
export function PreviewFrame({
  preview,
  device,
  onDevice,
  sample,
  missing,
  finding,
  notice = null,
  announce = null,
}: PreviewFrameProps) {
  const { t } = useTranslation()
  const stage = useRef<HTMLDivElement>(null)
  const fit = fitPreview(device, useRoom(stage))
  const { setScale, frame, frameKey, live, onFrameLoad } = preview
  useEffect(() => {
    setScale(fit.scale)
  }, [fit.scale, setScale])
  // The live frame stays on the page it shows while a sample is looked up: taken out, it would
  // load the session's address again (adr/0065 §1)
  const address = preview.address && !missing && (!finding || live) ? preview.address : null
  const [loaded, setLoaded] = useState<string | null>(null)
  // The spinner while a link is asked for, while the page it opens loads, and while the live
  // frame redraws
  const waiting =
    !missing &&
    !preview.isError &&
    (finding || (address ? loaded !== address || preview.stale || preview.busy : !preview.linked))
  let content: ReactNode
  if (missing) {
    content = <PreviewMessage text={missing} />
  } else if (preview.isError) {
    content = (
      <PreviewMessage
        text={`${t(`${V}.failed`)} ${errorText(t, preview.error)}`}
        action={
          <Button variant="outline" size="sm" onClick={preview.retry}>
            {t("common.retry")}
          </Button>
        }
      />
    )
  } else if (preview.linked && !address && !finding) {
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
      <div
        className="shrink-0 overflow-hidden rounded-md bg-background shadow-card ring-1 ring-border"
        style={{ width: fit.width * fit.scale, height: fit.height * fit.scale }}
      >
        <iframe
          key={frameKey}
          ref={frame}
          data-storefront-preview=""
          data-live={live ? "" : undefined}
          data-device={device}
          title={t(`${V}.frameTitle`)}
          src={address}
          // Its own scripts and storage; no forms sent, no taking over the panel's tab
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="block origin-top-left border-0 bg-background"
          style={{ width: fit.width, height: fit.height, transform: `scale(${String(fit.scale)})` }}
          onLoad={() => {
            setLoaded(address)
            onFrameLoad()
          }}
        />
      </div>
    )
  } else {
    content = null
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted">
      <PreviewBar sample={sample} device={device} onDevice={onDevice} scale={fit.scale} />
      <div className="relative flex min-h-0 min-w-0 flex-1 p-3 lg:p-4">
        <div ref={stage} className="flex min-h-0 min-w-0 flex-1 justify-center">
          {content}
        </div>
        {waiting ? (
          <div
            role="status"
            className="pointer-events-none absolute top-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-card"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t(address ? `${V}.refreshing` : `${V}.loading`)}
          </div>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="pointer-events-none absolute bottom-6 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full border bg-card px-3 py-1.5 text-center text-xs text-muted-foreground shadow-card"
          >
            {notice}
          </p>
        ) : null}
        {/* The section opened from the preview's edit label, said aloud (adr/0065 §6) */}
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>
    </div>
  )
}
