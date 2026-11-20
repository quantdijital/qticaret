import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import {
  AdminGetBrands,
  AdminPostBrand,
  AdminPostProductBrand,
  AdminUpdateBrand,
} from "../admin/brands/validators"
import { StoreGetBrandProducts, StoreGetBrands } from "../store/brands/validators"

/**
 * Brands (F3.11): the admin's list and saves, a product's brand, and the
 * storefront's brand list and pages. Integration keys may write brands
 * (an import brings them, F3.9).
 */
export const BRAND_ROUTES = [
  {
    matcher: "/admin/brands",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetBrands, {})],
  },
  // adr/0075: a long description document is past Express's 100 kB default; its own bounds stay
  {
    matcher: "/admin/brands",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminPostBrand)],
  },
  {
    matcher: "/admin/brands/:id",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminUpdateBrand)],
  },
  {
    matcher: "/admin/products/:id/brand",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostProductBrand)],
  },
  {
    matcher: "/store/brands",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetBrands, {})],
  },
  {
    matcher: "/store/brands/:id/products",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetBrandProducts, {})],
  },
]

/** A product's brand as the Store API shows it (`fields=+brand.name`). */
export const STORE_BRAND_FIELDS = [
  "brand",
  "brand.id",
  "brand.name",
  "brand.handle",
  "brand.logo_url",
  "brand.logo_width",
  "brand.logo_height",
]
