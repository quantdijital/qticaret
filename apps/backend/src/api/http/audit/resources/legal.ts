import type { MedusaContainer } from "@medusajs/framework/types"
import { isLegalKind } from "../../../../lib/legal"
import { LEGAL_MODULE } from "../../../../modules/legal"
import type LegalModuleService from "../../../../modules/legal/service"
import type { AuditedResource } from "../types"

/** A legal text published (F13.1): which version was in force before and after, and its hash. */
export const LEGAL_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/legal-documents/:kind/publish",
    pattern: /^\/admin\/legal-documents\/(?<kind>[a-z_]+)\/publish$/i,
    resourceType: "legal_document",
    resourceId: (params) => params["kind"] ?? null,
    snapshot: async ({ scope, params }) => {
      const kind = params["kind"] ?? ""
      if (!isLegalKind(kind)) {
        return {}
      }
      const published = await (scope as unknown as MedusaContainer)
        .resolve<LegalModuleService>(LEGAL_MODULE)
        .versionOf(kind, "published")
      return published ? { version: published.version, body_hash: published.body_hash } : {}
    },
  },
]
