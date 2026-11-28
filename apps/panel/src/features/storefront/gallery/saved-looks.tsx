import type { UseQueryResult } from "@tanstack/react-query"
import { Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { CollapsibleSection } from "@qticaret/admin-ui/patterns/collapsible-section"
import { EmptyState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { DesignCard as Design, DesignGallery } from "./api"
import { DesignCard, DesignRow } from "./design-card"
import { CardsLoading, GallerySection } from "./gallery-section"

const G = "storefront.gallery.saved"
// Named looks are small cards: four across on a wide screen
const NAMED_GRID =
  "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

interface SavedLooksProps {
  designs: UseQueryResult<DesignGallery>
  savedCount: number
  limits: DesignGallery["limits"]
  savedFull: boolean
  busy: boolean
  onSave: () => void
  onApply: (design: Design, name: string) => void
}

/**
 * "Kayıtlı görünümlerim" (adr/0064): the named looks as small cards, then
 * the automatic saves folded into one list, closed until opened (the
 * person's choice remembered): they are the safety net, not the choice.
 */
export function SavedLooks({
  designs,
  savedCount,
  limits,
  savedFull,
  busy,
  onSave,
  onApply,
}: SavedLooksProps) {
  const { t } = useTranslation()
  const gallery = designs.data
  // The count once it is known: not "0/10" while loading or when it could not be read
  const title = gallery
    ? t(`${G}.title`, { count: savedCount, max: limits.saved })
    : t(`${G}.heading`)
  const named = gallery?.designs.filter((each) => each.kind === "saved") ?? []
  const auto = gallery?.designs.filter((each) => each.kind === "auto") ?? []
  // The newest, whatever order the list comes in (ISO dates compare as text)
  const latest = auto.reduce<Design | undefined>(
    (newest, each) => (!newest || each.created_at > newest.created_at ? each : newest),
    undefined
  )
  const saveButton = (label: string) => (
    <Button variant="outline" size="sm" disabled={savedFull} onClick={onSave}>
      <Save />
      {label}
    </Button>
  )
  return (
    <GallerySection title={title} hint={t(`${G}.about`, { max: limits.auto })}>
      {designs.isError ? (
        // Said once, in the bar above
        <p className="text-sm text-muted-foreground">{t(`${G}.unavailable`)}</p>
      ) : !gallery ? (
        <CardsLoading count={2} />
      ) : gallery.designs.length === 0 ? (
        <EmptyState text={t(`${G}.empty`)} action={saveButton(t(`${G}.emptyAction`))} />
      ) : (
        <>
          {named.length > 0 ? (
            <div className={NAMED_GRID}>
              {named.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  savedFull={savedFull}
                  busy={busy}
                  onApply={onApply}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-4 py-3">
              <p className="text-sm text-muted-foreground">{t(`${G}.namedEmpty`)}</p>
              {saveButton(t(`${G}.emptyAction`))}
            </div>
          )}
          {latest ? (
            <CollapsibleSection
              id="looks-auto"
              name="storefront.looks.auto"
              title={t(`${G}.autoTitle`, { count: auto.length })}
              summary={t(`${G}.autoLatest`, { date: formatDateTime(latest.created_at) })}
              description={t(`${G}.autoNote`, { max: limits.auto })}
            >
              <ul className="-my-1 flex flex-col divide-y">
                {auto.map((design) => (
                  <DesignRow
                    key={design.id}
                    design={design}
                    savedFull={savedFull}
                    busy={busy}
                    onApply={onApply}
                  />
                ))}
              </ul>
            </CollapsibleSection>
          ) : null}
        </>
      )}
    </GallerySection>
  )
}
