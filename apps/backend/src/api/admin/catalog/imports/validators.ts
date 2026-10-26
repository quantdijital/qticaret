import { z } from "@medusajs/framework/zod"

/** `?mode=check` (the default) reports what the sheet would do; `apply` does it. */
export const AdminPostCatalogImportQuery = z
  .object({ mode: z.enum(["check", "apply"]).default("check") })
  .strict()
export type AdminPostCatalogImportQueryType = z.infer<typeof AdminPostCatalogImportQuery>
