import { useIsMutating, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Paintbrush } from "lucide-react"
import { useId, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState, ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { LAYOUT_ACTION_KEY, layoutQuery } from "@/features/storefront/api/layout"
import { errorText } from "@/lib/errors"
import { designsQuery, presetsQuery } from "./api"
import type { ApplyTarget, PresetCard as Preset } from "./api"
import { ApplyDialog } from "./apply-dialog"
import { CurrentLookCard } from "./current-look-card"
import { DesignCard } from "./design-card"
import { lookName, suggestedName } from "./design-name"
import { presetFamilies } from "./families"
import { SaveDesignDialog } from "./name-dialog"
import { PresetCard } from "./preset-card"
import { PresetPreviewDialog } from "./preset-preview-dialog"

const G = "storefront.gallery"
// Phone one, tablet two, wide three (docs/18 §3: looks are told apart by sight, PLAN §4.2)
const GRID = "grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"

/**
 * A titled run of look cards on the page itself: the cards are the
 * surfaces, never cards inside a card (docs/18 §3).
 */
function GallerySection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="text-[15px] leading-6 font-semibold">
          {title}
        </h2>
        <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function CardsLoading({ count }: { count: number }) {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" className={GRID}>
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-lg border p-3">
          <Skeleton className="aspect-[16/10] w-full rounded-md" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  )
}

/**
 * Vitrin › Görünümler (adr/0064, Ek 2026-11-17): where the design stands,
 * the shop's saved looks (named and automatic, one grid) and the
 * ready-made ones. A look goes into the draft, never live: the editor
 * opens on it and "Yayınla" stays its own step.
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
  const currentName = gallery
    ? lookName(t, gallery.current.draft, presets.data ?? [], gallery.designs)
    : t(`${G}.auto.own`)
  const applyPreset = (preset: Preset) => {
    setPreviewing(null)
    setApplying({ kind: "preset", preset })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t(`${G}.title`)}
        description={t(`${G}.description`)}
        action={
          <Button asChild>
            <Link to="/storefront/editor">
              <Paintbrush />
              {t(`${G}.openEditor`)}
            </Link>
          </Button>
        }
      />
      {designs.isError ? (
        <SectionCard title={t(`${G}.current.title`)}>
          <ErrorState text={errorText(t, designs.error)} onRetry={() => void designs.refetch()} />
        </SectionCard>
      ) : gallery ? (
        <CurrentLookCard gallery={gallery} presets={presets.data ?? []} savedFull={savedFull} />
      ) : (
        <SectionCard title={t(`${G}.current.title`)}>
          <Skeleton className="h-40 w-full" />
        </SectionCard>
      )}
      <GallerySection
        title={t(`${G}.saved.title`, { count: saved, max: limits.saved })}
        description={t(`${G}.saved.autoNote`, { max: limits.auto })}
      >
        {designs.isError ? (
          // Said once, in the card above
          <p className="text-sm text-muted-foreground">{t(`${G}.saved.unavailable`)}</p>
        ) : !gallery ? (
          <CardsLoading count={3} />
        ) : gallery.designs.length === 0 ? (
          <EmptyState
            text={t(`${G}.saved.empty`)}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSaving(true)
                }}
              >
                {t(`${G}.saved.emptyAction`)}
              </Button>
            }
          />
        ) : (
          <div className={GRID}>
            {gallery.designs.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                savedFull={savedFull}
                busy={busy}
                onApply={(each, name) => {
                  setApplying({ kind: "design", design: each, name })
                }}
              />
            ))}
          </div>
        )}
      </GallerySection>
      <GallerySection title={t(`${G}.presets.title`)} description={t(`${G}.presets.description`)}>
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
        currentName={currentName}
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
        initial={suggestedName(t, currentName)}
      />
    </div>
  )
}
