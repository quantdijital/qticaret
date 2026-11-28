import { useStartLinkRewrite } from "@/features/settings/api/content-links"
import { useStartMigration } from "@/features/settings/api/migration"
import type { MigrationJob } from "@/features/settings/api/migration"
import { useRebuildAddresses } from "@/features/settings/api/migration-overview"
import type { CompletionValues } from "@/features/settings/components/migration/completion-dialog"
import type { CompletionKey } from "@/features/settings/components/migration/completion-rows"

type ProductSource = "wordpress" | "shopify" | "feed"

/**
 * Starts a completion (adr/0042 Ek 2026-11-27): a refresh run from where
 * the products came from (applied: the dialog was the owner's word; it
 * proves itself again), the texts' links job, or the 301s made again.
 */
export function useStartCompletion(source: ProductSource | null) {
  const migration = useStartMigration()
  const links = useStartLinkRewrite()
  const addresses = useRebuildAddresses()
  const start = async (key: CompletionKey, values: CompletionValues): Promise<MigrationJob> => {
    if (key === "links") {
      return links.mutateAsync(false)
    }
    if (key === "urls") {
      return addresses.mutateAsync()
    }
    if (key === "new") {
      throw new Error("a new run opens the wizard")
    }
    return migration.mutateAsync({
      kind: source ?? "wordpress",
      mode: "apply",
      parcel: null,
      file: values.file,
      url: values.url,
      categoryBase: "",
      refresh: key,
    })
  }
  return {
    start,
    pending: migration.isPending || links.isPending || addresses.isPending,
  }
}
