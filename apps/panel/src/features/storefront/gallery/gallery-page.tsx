import { useIsMutating, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Paintbrush } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { FieldHints } from "@qticaret/admin-ui/hooks/use-field-hints"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { LAYOUT_ACTION_KEY, layoutQuery } from "@/features/storefront/api/layout"
import { errorText } from "@/lib/errors"
import { designsQuery, presetsQuery } from "./api"
import type { ApplyTarget, PresetCard as Preset } from "./api"
import { ApplyDialog } from "./apply-dialog"
import { CurrentLookCard } from "./current-look-card"
import { lookSource, suggestedName } from "./design-name"
import { presetFamilies } from "./families"
import { CardsLoading, GRID, GallerySection } from "./gallery-section"
import { SaveDesignDialog } from "./name-dialog"
import { PresetCard } from "./preset-card"
import { PresetPreviewDialog } from "./preset-preview-dialog"
import { SavedLooks } from "./saved-looks"

const G = "storefront.gallery"

function EditorLink() {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/storefront/editor">
        <Paintbrush />
        {t(`${G}.current.edit`)}
      </Link>
    </Button>
  )
}

/**
 * Vitrin › Görünümler (adr/0064, Ek 2026-11-17): where the design stands
 * in one bar, the ready-made looks to pick from, then the shop's own
 * saved looks (named ones as cards, automatic ones folded into a list).
 * A look goes into the draft, never live: the editor opens on it and
 * "Yayınla" stays its own step.
 */
export function GalleryPage() {
  const { t } = useTranslation()
  const designs = useQuery(designsQuery())
  const presets = useQuery(presetsQuery())
  const layout = useQuery(layoutQuery())
  const busy = useIsMutating({ mutationKey: LAYOUT_ACTION_KEY }) > 0
  const [applying, setApplying] = useState<ApplyTarget | null>(null)
  const [previewing, setPreviewing] = useState<Preset | null>(null)
  const [saving, setSaving] = useState(false)
  const families = useMemo(() => presetFamilies(presets.data ?? []), [presets.data])

  const gallery = designs.data
  const saved = gallery?.designs.filter((each) => each.kind === "saved").length ?? 0
  const limits = gallery?.limits ?? { saved: 10, auto: 5 }
  const savedFull = saved >= limits.saved
  const currentSource = gallery
    ? lookSource(t, gallery.current.draft, presets.data ?? [], gallery.designs)
    : t(`${G}.auto.own`)
  const applyPreset = (preset: Preset) => {
    setPreviewing(null)
    setApplying({ kind: "preset", preset })
  }

  return (
    <FieldHints style="tip">
      <div className="flex flex-col gap-6">
        <PageHeader title={t(`${G}.title`)} description={t(`${G}.description`)} />
        {designs.isError ? (
          <SectionCard title={t(`${G}.current.title`)} action={<EditorLink />}>
            <ErrorState text={errorText(t, designs.error)} onRetry={() => void designs.refetch()} />
          </SectionCard>
        ) : gallery ? (
          <CurrentLookCard gallery={gallery} presets={presets.data ?? []} savedFull={savedFull} />
        ) : (
          <SectionCard title={t(`${G}.current.title`)} action={<EditorLink />}>
            <Skeleton className="h-24 w-full" />
          </SectionCard>
        )}
        <GallerySection title={t(`${G}.presets.title`)} hint={t(`${G}.presets.description`)}>
          {presets.isError ? (
            <ErrorState text={errorText(t, presets.error)} onRetry={() => void presets.refetch()} />
          ) : !presets.data ? (
            <CardsLoading count={3} />
          ) : (
            <div className={GRID}>
              {families.map((family) => (
                <PresetCard
                  key={family.key}
                  family={family}
                  busy={busy}
                  onPreview={setPreviewing}
                  onApply={applyPreset}
                />
              ))}
            </div>
          )}
        </GallerySection>
        <SavedLooks
          designs={designs}
          savedCount={saved}
          limits={limits}
          savedFull={savedFull}
          busy={busy}
          onSave={() => {
            setSaving(true)
          }}
          onApply={(each, name) => {
            setApplying({ kind: "design", design: each, name })
          }}
        />
        <p className="text-[13px] text-muted-foreground">
          {t(`${G}.history.lead`)}{" "}
          <Link to="/storefront/editor" className="font-medium text-foreground underline">
            {t(`${G}.history.link`)}
          </Link>
        </p>
        <ApplyDialog
          target={applying}
          onClose={() => {
            setApplying(null)
          }}
          draftChanged={gallery?.current.draft.has_changes ?? false}
          pendingMenus={Boolean(layout.data?.draft.settings.menus)}
          savedFull={savedFull}
          savedLimit={limits.saved}
          currentName={currentSource}
        />
        <PresetPreviewDialog
          preset={previewing}
          onClose={() => {
            setPreviewing(null)
          }}
          onApply={applyPreset}
        />
        <SaveDesignDialog
          open={saving}
          onOpenChange={setSaving}
          initial={suggestedName(t, currentSource)}
        />
      </div>
    </FieldHints>
  )
}
