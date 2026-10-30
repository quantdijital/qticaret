import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export type SeoSetupItem =
  | "legal_identity"
  | "legal_texts"
  | "canonical_host"
  | "robots"
  | "share_image"
  | "search_console"
  | "merchant"
  | "indexnow"

/** Why an open item cannot be done from the panel yet. */
export type SeoSetupBlock = "google_platform" | "google_account"

export interface SeoSetupEntry {
  key: SeoSetupItem
  done: boolean
  blocked: SeoSetupBlock | null
}

/** The SEO setup checklist (F12.10), judged by the server from the shop's settings. */
export const seoSetupQuery = () =>
  queryOptions({
    queryKey: ["seo", "setup"],
    queryFn: () => sdk.client.fetch<{ items: SeoSetupEntry[] }>("/admin/seo/setup"),
  })
