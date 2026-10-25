import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../lib/errors"
import { isValidSlug, toSlug } from "../../lib/seo"
import { routePath } from "../http/request-path"

/**
 * Product, category and collection handles are storefront slugs (docs/13
 * §2.1). Medusa makes a missing one from the name and keeps Turkish letters
 * (`şef-bıçağı`), so here a missing handle is filled from the title or name
 * and a given one must already be a slug.
 *
 * Registered without `methods`: Medusa then mounts it before the core
 * route's body validator, which reads the filled handle. It sees what the
 * body parser left, so it only acts on the shapes it knows and leaves the
 * rest to that validator. The workflow hooks check again (imports skip
 * this middleware).
 */

type Body = Record<string, unknown>

// Create routes and the field their records are named by
const CREATE_SOURCES: Readonly<Record<string, string>> = {
  "/admin/products": "title",
  "/admin/product-categories": "name",
  "/admin/collections": "title",
}
const PRODUCT_BATCH = "/admin/products/batch"
const UPDATE = /^\/admin\/(?:products|product-categories|collections)\/[^/]+$/

const isBody = (value: unknown): value is Body =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const records = (value: unknown): Body[] => (Array.isArray(value) ? value.filter(isBody) : [])

function checkHandle(record: Body): void {
  const handle = record["handle"]
  if (handle !== undefined && (typeof handle !== "string" || !isValidSlug(handle))) {
    throw new ValidationError("catalog.handle_invalid", { field: "handle" })
  }
}

function fillHandle(record: Body, source: string): void {
  const handle = record["handle"]
  if (handle !== undefined && handle !== null && handle !== "") {
    checkHandle(record)
    return
  }
  const name = record[source]
  if (typeof name !== "string") {
    // No name to make one from: the core validator refuses the body
    return
  }
  const slug = toSlug(name)
  if (slug === "") {
    // Digits, emoji or punctuation only: the shop chooses the URL itself
    throw new ValidationError("catalog.handle_required", { field: "handle" })
  }
  record["handle"] = slug
}

function applyRules(path: string, body: Body): void {
  const source = Object.hasOwn(CREATE_SOURCES, path) ? CREATE_SOURCES[path] : undefined
  if (source !== undefined) {
    fillHandle(body, source)
  } else if (path === PRODUCT_BATCH) {
    records(body["create"]).forEach((record) => {
      fillHandle(record, "title")
    })
    records(body["update"]).forEach(checkHandle)
  } else if (UPDATE.test(path)) {
    checkHandle(body)
  }
}

export function slugHandles(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (req.method !== "POST" || !isBody(req.body)) {
    next()
    return
  }
  try {
    applyRules(routePath(req), req.body)
  } catch (error) {
    next(error)
    return
  }
  next()
}
