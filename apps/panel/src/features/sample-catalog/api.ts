import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A sector pack's sample set (`GET /admin/sample-catalog`). */
export interface SampleSet {
  pack: string
  /** As the pack names it ("Örnek turlar"). */
  name: string
  version: number
  products: number
  loaded: boolean
}

export type SampleBlockReason = "ordered" | "booked" | "customer_content"
export type SampleCategoryKeptReason = "own_products" | "samples_left" | "children"

export interface SampleProduct {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  pack: string
  /** Changed since it was loaded: the owner may want to keep it. */
  edited: boolean
  blocked: SampleBlockReason | null
  /** Reviews, questions and answers customers wrote on it: it stays while there are any. */
  customer_content?: number
}

export interface SampleCatalogStatus {
  sets: SampleSet[]
  catalog_empty: boolean
  products: SampleProduct[]
  categories: number
  reviews: number
}

export type SampleLoadState = "queued" | "running" | "succeeded" | "failed" | "cancelled"

/** The newest load, a background job: polled while it runs. */
export interface SampleLoadJob {
  id: string
  pack: string | null
  status: SampleLoadState
  progress: number
  summary: { products?: number } | null
  error_code: string | null
  created_at: string
}

export interface SampleCatalogAnswer {
  sample_catalog: SampleCatalogStatus
  load_job: SampleLoadJob | null
}

export const SAMPLE_PARTS = ["products", "categories", "reviews"] as const
export type SamplePart = (typeof SAMPLE_PARTS)[number]

export interface RemovalChoice {
  parts: SamplePart[]
  keep_product_ids: string[]
}

/** What a removal would do (`dry_run`) or did. */
export interface RemovalPlan {
  products: number
  categories: number
  reviews: number
  categories_hidden: number
  blocked: {
    id: string
    title: string
    reason: SampleBlockReason
    /** What customers wrote on it ("customer_content"). */
    customer_content?: number
  }[]
  /** What customers wrote on the sample products that stay for it. */
  customer_content?: number
  categories_kept: { id: string; name: string; reason: SampleCategoryKeptReason }[]
}

export const isLoading = (job: SampleLoadJob | null | undefined): boolean =>
  job?.status === "queued" || job?.status === "running"

const KEY = ["sample-catalog"] as const

const STATUS_KEY = [...KEY, "status"] as const

/**
 * The card's facts; every two seconds while a load runs. Polling asks for
 * the job alone (`?job=1`: the server does not read the whole catalogue
 * each time) and keeps the facts it had; once the job ends the whole
 * answer is read again.
 */
export const sampleCatalogQuery = (enabled = true) =>
  queryOptions({
    queryKey: STATUS_KEY,
    queryFn: async ({ client }) => {
      const before = client.getQueryData<SampleCatalogAnswer>(STATUS_KEY)
      if (before && isLoading(before.load_job)) {
        const { load_job } = await sdk.client.fetch<{ load_job: SampleLoadJob | null }>(
          "/admin/sample-catalog",
          { query: { job: "1" } }
        )
        if (isLoading(load_job)) {
          return { ...before, load_job }
        }
      }
      return sdk.client.fetch<SampleCatalogAnswer>("/admin/sample-catalog")
    },
    enabled,
    refetchInterval: (query) => (isLoading(query.state.data?.load_job) ? 2000 : false),
  })

/** Queues the load (202): the status query follows it. */
export function useLoadSamples() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (pack: string) =>
      sdk.client.fetch<{ load_job: SampleLoadJob | null }>("/admin/sample-catalog/load", {
        method: "POST",
        body: { pack },
      }),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: KEY })
    },
  })
}

/** What the chosen removal would take, read before the owner agrees. */
export const removalPreviewQuery = (choice: RemovalChoice, enabled: boolean) =>
  queryOptions({
    queryKey: [...KEY, "preview", choice],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ plan: RemovalPlan }>("/admin/sample-catalog/remove", {
          method: "POST",
          body: { ...choice, dry_run: true },
        })
      ).plan,
    enabled: enabled && choice.parts.length > 0,
  })

export function useRemoveSamples() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (choice: RemovalChoice) =>
      (
        await sdk.client.fetch<{ result: RemovalPlan }>("/admin/sample-catalog/remove", {
          method: "POST",
          body: choice,
        })
      ).result,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: KEY }),
        client.invalidateQueries({ queryKey: ["products"] }),
      ])
    },
  })
}

/**
 * A product the sample catalogue made, as the server knows it
 * (`isUnsellableSample`): the set's tag and its own id as `sample_of`; or
 * the tag and the load job making it with no `sample_of` yet (half made
 * by a stopped load). A copy carries another id and is the shop's.
 */
export function isSampleProduct(product: {
  id: string
  metadata?: Record<string, unknown> | null
}): boolean {
  const meta = product.metadata
  if (typeof meta?.["sample"] !== "string" || meta["sample"] === "") {
    return false
  }
  if (meta["sample_of"] === product.id) {
    return true
  }
  const job = meta["sample_job"]
  return !("sample_of" in meta) && typeof job === "string" && job !== ""
}
