import { Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { useSampleCatalog } from "@/features/sample-catalog/use-sample-catalog"

/**
 * "Örnek içerikle başlayın" in the empty product list (owner, 2026-11-28):
 * one button loads the pack's sample set; while it loads, how far. Shown
 * to those who may load it, when the pack has a set not loaded.
 */
export function SampleOffer() {
  const { t } = useTranslation()
  const samples = useSampleCatalog()
  if (!samples.can || !samples.data) {
    return null
  }
  if (samples.loading) {
    const percent = samples.job?.status === "running" ? samples.job.progress : 0
    return (
      <div className="mt-2 flex w-full max-w-sm flex-col gap-2 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">
          {samples.job?.status === "running"
            ? t("sampleCatalog.card.running", { percent })
            : t("sampleCatalog.card.queued")}
        </p>
        <Progress value={percent} aria-label={t("sampleCatalog.card.title")} />
      </div>
    )
  }
  const set = samples.offered
  if (!set) {
    return null
  }
  return (
    <div className="mt-2 flex w-full max-w-sm flex-col items-center gap-2 rounded-lg border bg-muted/40 p-4 text-center">
      <Sparkles className="size-5 text-primary-text" aria-hidden="true" />
      <p className="text-sm font-medium">{t("sampleCatalog.offer.title")}</p>
      <p className="text-sm text-muted-foreground">
        {t("sampleCatalog.offer.text", { name: set.name, count: set.products })}
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={samples.starting}
        onClick={() => {
          samples.start(set)
        }}
      >
        {samples.starting ? <Loader2 className="animate-spin" /> : null}
        {t("sampleCatalog.offer.load")}
      </Button>
    </div>
  )
}
