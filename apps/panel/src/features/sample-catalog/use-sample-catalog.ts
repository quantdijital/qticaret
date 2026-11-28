import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useCan } from "@/features/auth/api/staff"
import { isLoading, sampleCatalogQuery, useLoadSamples } from "@/features/sample-catalog/api"
import type { SampleSet } from "@/features/sample-catalog/api"
import { errorText } from "@/lib/errors"

const C = "sampleCatalog.card"

/**
 * The sample catalogue as a screen uses it: its facts (polled while a load
 * runs), the load queued with a word that it takes minutes, and the end of
 * a load said once it is seen (the product list read again).
 */
export function useSampleCatalog() {
  const { t } = useTranslation()
  const can = useCan("samples")
  const client = useQueryClient()
  const query = useQuery(sampleCatalogQuery(can))
  const load = useLoadSamples()
  const job = query.data?.load_job ?? null
  const loading = isLoading(job)
  const seenLoading = useRef(loading)

  useEffect(() => {
    if (seenLoading.current && !loading && job) {
      if (job.status === "succeeded") {
        toast.success(t(`${C}.loadedToast`, { count: job.summary?.products ?? 0 }))
        void client.invalidateQueries({ queryKey: ["products"] })
      } else if (job.status === "failed") {
        toast.error(t(`${C}.failed`))
      }
    }
    seenLoading.current = loading
  }, [loading, job, client, t])

  const start = (set: SampleSet) => {
    load.mutate(set.pack, {
      onSuccess: () => {
        seenLoading.current = true
        toast.success(t(`${C}.queuedToast`))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }

  const data = query.data?.sample_catalog
  return {
    can,
    query,
    data,
    job,
    loading,
    starting: load.isPending,
    start,
    /** The first set not loaded yet: what "Yükle" brings. */
    offered: data?.sets.find((set) => !set.loaded),
  }
}
