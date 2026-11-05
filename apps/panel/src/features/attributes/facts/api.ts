import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { SheetJob } from "@/features/products/api/sheets"
import { sdk } from "@/lib/sdk"
import type { FactsRunInput } from "./choices"
import type { FactsPreview } from "./types"

/**
 * The facts in products' descriptions (adr/0013 Ek 2026-11-05): what they
 * would become, read fresh each time the dialog opens (the products may
 * have changed), and the run that writes them, a job like a bulk edit.
 */
export const factsPreviewQuery = (productIds: readonly string[], templateId: string | null) =>
  queryOptions({
    queryKey: ["description-facts", productIds, templateId],
    queryFn: () =>
      sdk.client.fetch<FactsPreview>("/admin/description-facts/preview", {
        method: "POST",
        body: { product_ids: productIds, ...(templateId ? { template_id: templateId } : {}) },
      }),
    enabled: productIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    // A new template for the products without one keeps the list on screen while it reads
    placeholderData: keepPreviousData,
  })

export const startFactsRun = async (input: FactsRunInput): Promise<SheetJob> =>
  (
    await sdk.client.fetch<{ async_job: SheetJob }>("/admin/async-jobs", {
      method: "POST",
      body: { type: "catalog.description_facts", input },
    })
  ).async_job
