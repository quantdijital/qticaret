import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import type { SampleSet } from "@/features/sample-catalog/api"
import { RemoveSamplesDialog } from "@/features/sample-catalog/remove-dialog"
import { SAMPLE_CARD_ID } from "@/features/sample-catalog/sample-badge"
import { useSampleCatalog } from "@/features/sample-catalog/use-sample-catalog"

const C = "sampleCatalog.card"

/**
 * Settings › "Örnek içerik" (owner, 2026-11-28): the sector pack's sample
 * set, always reachable: not loaded, loading with its percent, or how many
 * samples are here; "Yükle" and "Örnek içeriği kaldır". The owner and
 * admin only; a shop whose pack brings no set and holds no sample sees nothing.
 */
export function SampleCatalogCard() {
  const { t } = useTranslation()
  const samples = useSampleCatalog()
  const [removing, setRemoving] = useState(false)
  const data = samples.data
  if (!samples.can || !data || (data.sets.length === 0 && data.products.length === 0)) {
    return null
  }
  const job = samples.job
  const failed = job?.status === "failed" && !samples.loading
  const state = (set: SampleSet) => {
    if (samples.loading && job?.pack === set.pack) {
      const percent = job.status === "running" ? job.progress : 0
      return (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm">
            {job.status === "running" ? t(`${C}.running`, { percent }) : t(`${C}.queued`)}
          </span>
          <Progress value={percent} aria-label={t(`${C}.title`)} />
        </div>
      )
    }
    return (
      <span className="text-sm text-muted-foreground">
        {set.loaded
          ? t(`${C}.loaded`, {
              count: data.products.filter((product) => product.pack === set.pack).length,
            })
          : t(`${C}.none`)}
      </span>
    )
  }
  return (
    <div id={SAMPLE_CARD_ID} className="scroll-mt-24">
      <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {data.sets.map((set) => (
              <li
                key={set.pack}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
              >
                <div className="flex min-w-48 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">
                    {t(`${C}.set`, { name: set.name, count: set.products })}
                  </span>
                  {state(set)}
                </div>
                {set.loaded || samples.loading ? null : (
                  <Button
                    size="sm"
                    disabled={samples.starting}
                    onClick={() => {
                      samples.start(set)
                    }}
                  >
                    {samples.starting ? <Loader2 className="animate-spin" /> : null}
                    {t(`${C}.load`)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {failed ? <p className="text-sm text-warning-text">{t(`${C}.failed`)}</p> : null}
          {data.products.length > 0 || data.reviews > 0 || data.categories > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {t(`${C}.extras`, { categories: data.categories, reviews: data.reviews })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={samples.loading}
                onClick={() => {
                  setRemoving(true)
                }}
              >
                {t(`${C}.remove`)}
              </Button>
            </div>
          ) : null}
        </div>
      </SectionCard>
      {removing ? (
        <RemoveSamplesDialog
          products={data.products}
          onClose={() => {
            setRemoving(false)
          }}
        />
      ) : null}
    </div>
  )
}
