import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { contentDraftProvider, draftMonthlyQuota } from "../../../lib/content-drafts/provider"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { CONTENT_AI_DRAFTS } from "../../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { generateDraftWorkflow } from "../../../workflows/content/drafts"
import type { AdminGetContentDraftsType, AdminPostContentDraftType } from "./validators"

/**
 * GET /admin/content-drafts (F10.13): a product's latest drafts, whether
 * drafts are on and a provider set, and the month's quota.
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetContentDraftsType>,
  res: MedusaResponse
): Promise<void> {
  const query = req.validatedQuery as AdminGetContentDraftsType
  const drafts = req.scope.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
  const [rows, used, enabled] = await Promise.all([
    drafts.listContentDrafts(
      { entity_type: query.entity_type, entity_id: query.entity_id },
      {
        take: 20,
        order: { created_at: "DESC" },
        select: ["id", "kind", "text", "status", "problems", "provider", "source", "created_at"],
      }
    ),
    drafts.usedThisMonth(),
    req.scope
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(CONTENT_AI_DRAFTS),
  ])
  res.json({
    drafts: rows,
    enabled,
    provider_ready: contentDraftProvider() !== null,
    quota: { used, limit: draftMonthlyQuota() },
  })
}

/** POST /admin/content-drafts: a new draft of a product's text; never published here. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostContentDraftType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await generateDraftWorkflow(req.scope).run({
    input: { ...req.validatedBody, user_id: req.auth_context.actor_id },
  })
  res.status(201).json({ draft: result })
}
