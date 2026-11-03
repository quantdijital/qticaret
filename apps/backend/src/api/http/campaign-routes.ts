import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { MARKETING_CAMPAIGNS } from "../../modules/platform-settings/features"
import {
  AdminCampaignAction,
  AdminCopyCampaign,
  AdminGetCampaigns,
  AdminPostCampaign,
  AdminPreviewCampaignAudience,
  AdminScheduleCampaign,
  AdminUpdateCampaign,
} from "../admin/bulk-messages/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { requireReauth } from "./reauth"
import { requireFeature } from "./require-feature"

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => unknown

const staffOf = (req: MedusaRequest) =>
  (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id

/** A test send goes to the asker alone; still, ten an hour each (adr/0050 §5). */
const TEST_SEND: RateLimitProfile = {
  name: "campaign_test_send",
  perIdentityAnyIp: { max: 10, windowMs: 60 * 60 * 1000 },
}

// Counting an audience reads every customer and consent: a small budget per staff member
const perStaff = (profile: RateLimitProfile) => rateLimit(() => profile, { identity: staffOf })

/**
 * adr/0050: bulk e-mail and SMS, behind `marketing.campaigns` (first, so a
 * shop without it sees no route at all), for people only. Writes are the
 * owner's and admin's (adr/0040: `operations` is refused by default);
 * "Gönder" and "Zamanla" ask the person to prove themselves again: a
 * stolen session could otherwise write to thousands in the shop's name.
 */
const guarded = (...middlewares: Middleware[]): Middleware[] => [
  requireFeature(MARKETING_CAMPAIGNS),
  requireUserActor,
  ...middlewares,
]

const action = (path: string, ...middlewares: Middleware[]) => ({
  matcher: `/admin/bulk-messages/:id/${path}`,
  methods: ["POST" as const],
  middlewares: guarded(...middlewares),
})

export const CAMPAIGN_ROUTES = [
  {
    matcher: "/admin/bulk-messages",
    methods: ["GET" as const],
    middlewares: guarded(validateAndTransformQuery(AdminGetCampaigns, {})),
  },
  {
    matcher: "/admin/bulk-messages",
    methods: ["POST" as const],
    middlewares: guarded(validateAndTransformBody(AdminPostCampaign)),
  },
  { matcher: "/admin/bulk-messages/:id", methods: ["GET" as const], middlewares: guarded() },
  {
    matcher: "/admin/bulk-messages/:id",
    methods: ["POST" as const],
    middlewares: guarded(validateAndTransformBody(AdminUpdateCampaign)),
  },
  { matcher: "/admin/bulk-messages/:id", methods: ["DELETE" as const], middlewares: guarded() },
  {
    matcher: "/admin/bulk-messages/:id/report",
    methods: ["GET" as const],
    middlewares: guarded(),
  },
  action(
    "audience-preview",
    perStaff(RATE_LIMIT_PROFILES.bulk_ship),
    validateAndTransformBody(AdminPreviewCampaignAudience)
  ),
  action("test-send", perStaff(TEST_SEND), validateAndTransformBody(AdminCampaignAction)),
  action("schedule", validateAndTransformBody(AdminScheduleCampaign), requireReauth()),
  action("send", validateAndTransformBody(AdminCampaignAction), requireReauth()),
  action("pause", validateAndTransformBody(AdminCampaignAction)),
  action("resume", validateAndTransformBody(AdminCampaignAction)),
  action("cancel", validateAndTransformBody(AdminCampaignAction)),
  action("copy", validateAndTransformBody(AdminCopyCampaign)),
]
