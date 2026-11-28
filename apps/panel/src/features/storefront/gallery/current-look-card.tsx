import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Eye, Paintbrush, Save } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { InfoTip, TitleTip } from "@qticaret/admin-ui/patterns/info-tip"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { layoutQuery } from "@/features/storefront/api/layout"
import type { DesignGallery, PresetCard } from "./api"
import { lookName, lookSource, suggestedName } from "./design-name"
import { DesignThumb } from "./design-thumb"
import { draftSketch } from "./draft-summary"
import { hasNewVersion, isLook } from "./families"
import { LookFacts } from "./look-facts"
import { SaveDesignDialog } from "./name-dialog"
import { PresetPicture } from "./preset-card"
import { useDraftPreview } from "./use-draft-preview"

const G = "storefront.gallery.current"

interface CurrentLookCardProps {
  gallery: DesignGallery
  presets: readonly PresetCard[]
  /** No room for another named look. */
  savedFull: boolean
}

/** Where the design stands, said once: live and the same, waiting to be published, or never live. */
function Standing({ gallery, liveName }: { gallery: DesignGallery; liveName: string }) {
  const { t } = useTranslation()
  const { draft, live } = gallery.current
  if (!(live.revision > 0 && live.published_at)) {
    return (
      <>
        <StatusBadge tone="neutral">{t(`${G}.notLive`)}</StatusBadge>
        <span>{t(`${G}.defaultShown`)}</span>
      </>
    )
  }
  const date = formatDateTime(live.published_at)
  return draft.has_changes ? (
    <>
      <StatusBadge tone="warning">{t(`${G}.draftChanged`)}</StatusBadge>
      <span>{t(`${G}.liveIs`, { name: liveName, date })}</span>
    </>
  ) : (
    <>
      <StatusBadge tone="success">{t("storefront.gallery.badge.live")}</StatusBadge>
      <span>{t(`${G}.since`, { date })}</span>
    </>
  )
}

/**
 * "Şu anki görünüm" in one bar: the draft's picture (the ready-made
 * look's own when the draft came from one, else drawn from the draft),
 * its name, where it stands, its faces and size; preview it as the
 * storefront draws it, edit it, or keep it.
 */
export function CurrentLookCard({ gallery, presets, savedFull }: CurrentLookCardProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const layout = useQuery(layoutQuery())
  const preview = useDraftPreview()
  const [saving, setSaving] = useState(false)
  const { draft, live } = gallery.current
  const draftName = lookName(t, draft, presets, gallery.designs)
  const liveName = lookName(t, live, presets, gallery.designs)
  const source = draft.design_id ? undefined : presets.find((each) => isLook(each, draft.preset))
  const newer = source !== undefined && hasNewVersion(source)
  const sketch = layout.data ? draftSketch(layout.data.draft) : null
  const title = t(`${G}.title`)
  return (
    <section
      aria-labelledby={titleId}
      className="@container flex min-w-0 flex-col rounded-lg border bg-card p-3 text-card-foreground shadow-card"
    >
      <div className="flex flex-col gap-3 @xl:flex-row @xl:items-center">
        {/* The picture small beside the words, a phone too: the bar stays one glance */}
        <div className="flex min-w-0 flex-1 items-start gap-3 @xl:items-center">
          <div className="w-28 shrink-0 @md:w-44">
            {source?.preview_url ? (
              <PresetPicture preset={source} />
            ) : sketch ? (
              <DesignThumb summary={sketch} />
            ) : (
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <div className="flex items-center gap-1.5">
              <h2 id={titleId} className="text-xs font-medium text-muted-foreground">
                {title}
              </h2>
              <TitleTip title={title} hint={t(`${G}.about`)} className="h-4" />
            </div>
            <p className="text-[15px] leading-6 font-semibold break-words">
              {draft.edited ? t(`${G}.draftEdited`, { name: draftName }) : draftName}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Standing gallery={gallery} liveName={liveName} />
            </p>
            {sketch ? <LookFacts summary={sketch} /> : null}
            {newer ? (
              <span className="flex items-center gap-1.5">
                <StatusBadge tone="info">{t("storefront.gallery.badge.newVersion")}</StatusBadge>
                <InfoTip
                  name={t("storefront.gallery.badge.newVersion")}
                  hint={t(`${G}.newVersion`)}
                />
              </span>
            ) : null}
            {savedFull ? <p className="text-xs text-muted-foreground">{t(`${G}.full`)}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 @xl:flex-col @xl:items-stretch @3xl:flex-row">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={preview.opening}
            aria-label={t(`${G}.previewDraft`)}
            onClick={() => void preview.open()}
          >
            <Eye />
            {t("storefront.gallery.presets.preview")}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/storefront/editor">
              <Paintbrush />
              {t(`${G}.edit`)}
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={savedFull}
            aria-label={t(`${G}.save`)}
            title={savedFull ? t(`${G}.full`) : undefined}
            onClick={() => {
              setSaving(true)
            }}
          >
            <Save />
            {t(`${G}.saveShort`)}
          </Button>
        </div>
      </div>
      <SaveDesignDialog
        open={saving}
        onOpenChange={setSaving}
        initial={suggestedName(t, lookSource(t, draft, presets, gallery.designs))}
      />
    </section>
  )
}
