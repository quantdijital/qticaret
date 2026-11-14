import { validateAndTransformBody } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import {
  AdminPostStorefrontLayout,
  AdminPostStorefrontLayoutAction,
  AdminPostStorefrontLayoutRestore,
} from "../admin/storefront-layout/validators"
import { AdminPostStorefrontMenu } from "../admin/storefront-menus/validators"
import { AdminPostStorefrontPresetApply } from "../admin/storefront-presets/validators"
import type { RateLimitProfile } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

/** A preset applied by hand (adr/0063 §7): each reads the pack's files and may upload images. */
const PRESET_APPLY: RateLimitProfile = {
  name: "storefront_preset_apply",
  perIdentityAnyIp: { max: 20, windowMs: 60 * 60 * 1000 },
}

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
  {
    matcher: "/admin/storefront-layout",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontLayout)],
  },
  ...[
    "/admin/storefront-layout/publish",
    "/admin/storefront-layout/discard",
    "/admin/storefront-layout/preview",
  ].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontLayoutAction)],
  })),
  {
    matcher: "/admin/storefront-layout/revisions/:revision/restore",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostStorefrontLayoutRestore)],
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
