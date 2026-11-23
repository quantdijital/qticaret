import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { AsyncJob } from "./activity"

export type UrlStyle = "prefixed" | "flat"
/** Categories also take the tree without the prefix (adr/0017 Ek 2026-11-23). */
export type CategoryUrlStyle = UrlStyle | "nested"

export interface UrlStyles {
  product: UrlStyle
  category: CategoryUrlStyle
  brand: UrlStyle
}

export interface StyleRecord {
  entity_type: string
  entity_id: string
  name: string
}

/** `GET /admin/seo/url-style`: what moving to `styles` would do (docs/13 §2.2). */
export interface StyleCheck {
  moves: number
  conflicts: {
    path: string
    reason: "shared" | "reserved_root" | "taken"
    records: StyleRecord[]
    holder?: { entity_type: string; entity_id: string; status: "active" | "reserved" }
  }[]
  skipped: StyleRecord[]
}

export const checkUrlStyle = (styles: UrlStyles) =>
  sdk.client.fetch<StyleCheck>("/admin/seo/url-style", { query: { ...styles } })

export const URL_STYLE_JOB = "seo.url_style"

/** One long task, looked at every second while it runs. */
export const jobQuery = (id: string | null) =>
  queryOptions({
    queryKey: ["settings", "jobs", "one", id],
    queryFn: async () =>
      (await sdk.client.fetch<{ async_job: AsyncJob }>(`/admin/async-jobs/${id ?? ""}`)).async_job,
    enabled: id !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "queued" || query.state.data?.status === "running"
        ? 1000
        : false,
  })
