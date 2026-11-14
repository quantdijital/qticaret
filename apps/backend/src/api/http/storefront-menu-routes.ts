import { validateAndTransformBody } from "@medusajs/framework/http"
import {
  AdminPostStorefrontLayout,
  AdminPostStorefrontLayoutAction,
  AdminPostStorefrontLayoutRestore,
} from "../admin/storefront-layout/validators"
import { AdminPostStorefrontMenu } from "../admin/storefront-menus/validators"

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
]
