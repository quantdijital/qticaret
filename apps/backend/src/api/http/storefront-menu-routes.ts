import { validateAndTransformBody } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  AdminPostStorefrontLayout,
  AdminPostStorefrontLayoutAction,
  AdminPostStorefrontLayoutPublish,
  AdminPostStorefrontLayoutRestore,
} from "../admin/storefront-layout/validators"
import { AdminPostStorefrontMenu } from "../admin/storefront-menus/validators"
import { AdminPostStorefrontPresetApply } from "../admin/storefront-presets/validators"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** A preset applied by hand (adr/0063 §7): each reads the pack's files and may upload images. */
const PRESET_APPLY: RateLimitProfile = {
  name: "storefront_preset_apply",
  perIdentityAnyIp: { max: 20, windowMs: 60 * 60 * 1000 },
}

/** The draft replaced (discarded, a revision restored): as a look applied, per staff member. */
const draftReplaced = [
  requireUserActor,
  rateLimit(() => RATE_LIMIT_PROFILES.storefront_draft_replace, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  }),
]

/** The storefront's menus and theme editor (adr/0049): written whole, checked by one schema. */
export const STOREFRONT_MENU_ROUTES = [
  {
    matcher: "/admin/storefront-menus",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontMenu)],
  },
  {
    matcher: "/admin/storefront-menus/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontMenu)],
  },
  // The whole design, content pages' layouts included (adr/0073 §1): past Express's 100 kB
  // default; the schema holds the document itself to a megabyte (`storefront_layout.too_large`)
  {
    matcher: "/admin/storefront-layout",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminPostStorefrontLayout)],
  },
  // adr/0073 Ek 2026-11-19 (2) K5: the content pages in draft that go live with it
  {
    matcher: "/admin/storefront-layout/publish",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontLayoutPublish)],
  },
  {
    matcher: "/admin/storefront-layout/preview",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontLayoutAction)],
  },
  // adr/0064 Ek 2026-11-17: each keeps the draft first as an automatic save
  // (its author recorded), so people only, rate limited per staff member
  {
    matcher: "/admin/storefront-layout/discard",
    methods: ["POST" as const],
    middlewares: [...draftReplaced, validateAndTransformBody(AdminPostStorefrontLayoutAction)],
  },
  // adr/0065: the theme editor's live preview session, a person's from their panel session
  {
    matcher: "/admin/storefront-layout/editor-session",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => RATE_LIMIT_PROFILES.layout_session_open, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(AdminPostStorefrontLayoutAction),
    ],
  },
  {
    matcher: "/admin/storefront-layout/editor-session/:id",
    methods: ["PUT" as const, "DELETE" as const],
    middlewares: [requireUserActor],
  },
  // Its draft, read by the storefront after every save; a guessed token finds nothing
  {
    matcher: "/store/storefront-layout/session/:token",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.layout_session)],
  },
  // A content page in the same session (adr/0073 §5): read after every save as the draft is
  {
    matcher: "/store/storefront-layout/session/:token/pages/:id",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.layout_session)],
  },
  // A content page through the signed design link (adr/0073 §6; security review
  // 2026-11-19, I3): limited as a draft's signed preview; a guessed token finds nothing
  {
    matcher: "/store/storefront-layout/preview/:token/pages/:id",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.content_preview)],
  },
  {
    matcher: "/admin/storefront-layout/revisions/:revision/restore",
    methods: ["POST" as const],
    middlewares: [...draftReplaced, validateAndTransformBody(AdminPostStorefrontLayoutRestore)],
  },
  {
    matcher: "/admin/storefront-presets/:pack/:code/apply",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      rateLimit(() => PRESET_APPLY, {
        identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
      }),
      validateAndTransformBody(AdminPostStorefrontPresetApply),
    ],
  },
]
