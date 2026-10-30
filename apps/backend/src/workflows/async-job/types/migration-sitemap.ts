import { z } from "@medusajs/framework/zod"
import { importSitemap } from "../../migration/old-site"
import type { JobType } from "./types"

const input = z.object({ url: z.url({ protocol: /^https?$/ }).max(2048) }).strict()

/**
 * The old site's sitemap read into the address inventory (F14.7, adr/0042
 * §8): queued by `POST /admin/migrations/urls/sitemap`, the owner's alone.
 * Fetched under the SSRF rules; it writes only the inventory.
 */
export const migrationSitemap: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  group: "catalog.write",
  resultTtlDays: 1,
  containsPersonalData: false,
  privateToAsker: true,
  internal: true,
  execute: async ({ container, progress }, { url }) => {
    const read = await importSitemap(container, url, (done, total) =>
      progress(total > 0 ? (done / total) * 100 : 100)
    )
    return { summary: { ...read } }
  },
}
