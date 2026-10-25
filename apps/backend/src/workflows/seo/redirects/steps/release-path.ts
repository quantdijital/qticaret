import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../../lib/errors"
import { normalizePath } from "../../../../lib/seo/redirects"
import { URL_REGISTRY_MODULE } from "../../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../../catalog/entity-paths"

/**
 * Gives an old path up for good (docs/13 §2.1): its redirect or 410 stops
 * and another record may take it, such as a product made again under the
 * name of one deleted. A path a record uses now cannot be released.
 */
export const releasePathStep = createStep(
  "seo-release-path",
  async (input: { path: string }, { container }) => {
    const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    const path = normalizePath(input.path)
    const [entry] = path
      ? await registry.listUrlEntries({ locale: CATALOG_LOCALE, path }, { take: 1 })
      : []
    if (!entry) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.path_unknown")
    }
    if (entry.status === "active") {
      throw new ValidationError("seo.path_active", { field: "path" })
    }
    await registry.softDeleteUrlEntries([entry.id])
    return new StepResponse({ path: entry.path }, entry.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE).restorePaths([id])
    }
  }
)
