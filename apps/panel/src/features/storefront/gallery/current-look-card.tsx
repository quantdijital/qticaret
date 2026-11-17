import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Paintbrush, Save } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { layoutQuery } from "@/features/storefront/api/layout"
import type { DesignGallery, PresetCard } from "./api"
import { lookName, suggestedName } from "./design-name"
import { DesignThumb } from "./design-thumb"
import { draftSketch } from "./draft-summary"
import { hasNewVersion, isLook } from "./families"
import { LookFacts } from "./look-facts"
import { SaveDesignDialog } from "./name-dialog"

const G = "storefront.gallery.current"

interface CurrentLookCardProps {
  gallery: DesignGallery
  presets: readonly PresetCard[]
  /** No room for another named look. */
  savedFull: boolean
}

/**
 * "Şu anki görünüm": the draft as the editor holds it, drawn; what is
 * live and since when; whether the draft waits to be published; a newer
 * version of the ready-made look it came from. Edit it, or keep it.
 */
export function CurrentLookCard({ gallery, presets, savedFull }: CurrentLookCardProps) {
  const { t } = useTranslation()
  const layout = useQuery(layoutQuery())
  const [saving, setSaving] = useState(false)
  const { draft, live } = gallery.current
  const draftName = lookName(t, draft, presets, gallery.designs)
  const liveName = lookName(t, live, presets, gallery.designs)
  const source = draft.design_id ? null : presets.find((each) => isLook(each, draft.preset))
  const newer = source !== undefined && source !== null && hasNewVersion(source)
  const sketch = layout.data ? draftSketch(layout.data.draft) : null
  return (
    <SectionCard
      title={t(`${G}.title`)}
      action={
        <>
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
            title={savedFull ? t(`${G}.full`) : undefined}
            onClick={() => {
              setSaving(true)
            }}
          >
            <Save />
            {t(`${G}.save`)}
          </Button>
        </>
      }
    >
      {/* Side by side once the card has room for both (the menu beside it at a tablet) */}
      <div className="@container">
        <div className="flex flex-col gap-4 @xl:flex-row @xl:items-start">
          <div className="w-full shrink-0 @xl:w-72">
            {sketch ? (
              <DesignThumb summary={sketch} />
            ) : (
              <Skeleton className="aspect-[16/10] w-full rounded-md" />
            )}
          </div>
          {/* Only the two name / value pairs are the list: the rest are notes beside it */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 text-sm">
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t(`${G}.liveLabel`)}</dt>
                <dd className="font-medium">
                  {live.revision > 0 && live.published_at
                    ? t(`${G}.live`, { name: liveName, date: formatDate(live.published_at) })
                    : t(`${G}.neverLive`)}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">{t(`${G}.draftLabel`)}</dt>
                <dd className="flex flex-col items-start gap-1.5">
                  <span className="font-medium">
                    {draft.edited ? t(`${G}.draftEdited`, { name: draftName }) : draftName}
                  </span>
                  <StatusBadge tone={draft.has_changes ? "warning" : "success"}>
                    {t(draft.has_changes ? `${G}.draftChanged` : `${G}.draftSame`)}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
            {newer ? (
              <div className="flex flex-col items-start gap-1">
                <StatusBadge tone="info">{t("storefront.gallery.badge.newVersion")}</StatusBadge>
                <p className="text-[13px] leading-5 text-muted-foreground">
                  {t(`${G}.newVersion`)}
                </p>
              </div>
            ) : null}
            {sketch ? <LookFacts summary={sketch} /> : null}
            {savedFull ? <p className="text-xs text-muted-foreground">{t(`${G}.full`)}</p> : null}
          </div>
        </div>
      </div>
      <SaveDesignDialog
        open={saving}
        onOpenChange={setSaving}
        initial={suggestedName(t, draftName)}
      />
    </SectionCard>
  )
}
