import type { MedusaContainer } from "@medusajs/framework/types"
import { isLegalKind } from "../../../../lib/legal"
import { LEGAL_MODULE } from "../../../../modules/legal"
import type LegalModuleService from "../../../../modules/legal/service"
import { bodyHashOf } from "../../../../workflows/legal/documents"
import type { AuditedResource, SnapshotInput } from "../types"

const legalOf = (scope: SnapshotInput["scope"]) =>
  (scope as unknown as MedusaContainer).resolve<LegalModuleService>(LEGAL_MODULE)

/** The kind's draft: its number, title and the hash of its text; nothing when there is none. */
async function draftSnapshot({ scope, params }: SnapshotInput) {
  const kind = params["kind"] ?? ""
  if (!isLegalKind(kind)) {
    return {}
  }
  const draft = await legalOf(scope).versionOf(kind, "draft")
  return draft
    ? { draft_version: draft.version, draft_title: draft.title, draft_hash: bodyHashOf(draft.body) }
    : {}
}

/**
 * A legal text published (F13.1): which version was in force before and
 * after, and its hash. Its draft dropped or started again (the owner,
 * 2026-11-04): the draft before and after, by number and the hash of its text.
 */
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
      const published = await legalOf(scope).versionOf(kind, "published")
      return published ? { version: published.version, body_hash: published.body_hash } : {}
    },
  },
  {
    method: "DELETE",
    route: "DELETE /admin/legal-documents/:kind/draft",
    pattern: /^\/admin\/legal-documents\/(?<kind>[a-z_]+)\/draft$/i,
    resourceType: "legal_document",
    resourceId: (params) => params["kind"] ?? null,
    snapshot: draftSnapshot,
  },
  {
    method: "POST",
    route: "POST /admin/legal-documents/:kind/draft/reset",
    pattern: /^\/admin\/legal-documents\/(?<kind>[a-z_]+)\/draft\/reset$/i,
    resourceType: "legal_document",
    resourceId: (params) => params["kind"] ?? null,
    snapshot: draftSnapshot,
  },
]
