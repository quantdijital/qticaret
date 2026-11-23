import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { toStoredAddons } from "../../lib/catalog/addons"
import type { AddonInput, StoredAddons } from "../../lib/catalog/addons"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { addonTemplatesByIds } from "../addons/effective"
import {
  addonTemplateUsage,
  attributeTemplateCarries,
  checkAddonLimit,
  productLinksOf,
  productsOfAttributeTemplates,
  requireAddonsFlag,
  withTemplate,
} from "./usage"

/**
 * Add-on template steps (adr/0052 Ek 2026-11-23); each undoes itself if
 * a later step fails.
 */

type Service = ProductAttributesModuleService

const serviceOf = (container: Pick<MedusaContainer, "resolve">): Service =>
  container.resolve<Service>(PRODUCT_ATTRIBUTES_MODULE)

// A json column is typed as an object; it holds `{ items }`
const addonsColumn = (addons: StoredAddons) => addons as unknown as Record<string, unknown>
const idsColumn = (ids: readonly string[]) =>
  (ids.length > 0 ? [...ids] : null) as unknown as Record<string, unknown> | null

const newId = (prefix: "ad" | "ch") => `${prefix}_${randomBytes(6).toString("hex")}`

export interface AddonTemplateInput {
  name: string
  addons: AddonInput[]
}

export const createAddonTemplateStep = createStep(
  "addon-templates-create",
  async (input: AddonTemplateInput, { container }) => {
    await requireAddonsFlag(container)
    const created = await serviceOf(container).createAddonTemplates({
      name: input.name,
      addons: addonsColumn({ items: toStoredAddons(input.addons, newId) }),
    })
    return new StepResponse({ id: created.id }, created.id)
  },
  async (id: string | undefined, { container }) => {
    if (id) {
      await serviceOf(container).deleteAddonTemplates(id)
    }
  }
)

export interface UpdateAddonTemplateInput {
  id: string
  name?: string | undefined
  /** The whole list; ids sent are kept (cart lines name add-ons by them). */
  addons?: AddonInput[] | undefined
}

interface Previous {
  id: string
  name: string
  addons: Record<string, unknown> | null
}

/**
 * A template changed: every product using it reads the change at once.
 * More add-ons than before must keep each of them within five.
 */
export const updateAddonTemplateStep = createStep(
  "addon-templates-update",
  async (input: UpdateAddonTemplateInput, { container }) => {
    const service = serviceOf(container)
    const current = await service.retrieveAddonTemplate(input.id)
    const previous: Previous = {
      id: current.id,
      name: current.name,
      addons: current.addons ?? null,
    }
    const update: { id: string; name?: string; addons?: Record<string, unknown> } = {
      id: input.id,
    }
    if (input.name !== undefined) {
      update.name = input.name
    }
    if (input.addons !== undefined) {
      await requireAddonsFlag(container)
      const items = toStoredAddons(input.addons, newId)
      const before = (await addonTemplatesByIds(container, [input.id])).get(input.id)
      if (before && items.length > before.addons.length) {
        const usage = await addonTemplateUsage(container, input.id)
        await checkAddonLimit(
          container,
          [...new Set([...usage.product_ids, ...usage.carried_product_ids])],
          withTemplate({ ...before, addons: items }),
          "addon_templates.too_many"
        )
      }
      update.addons = addonsColumn({ items })
    }
    await service.updateAddonTemplates(update)
    return new StepResponse({ id: input.id }, previous)
  },
  async (previous: Previous | undefined, { container }) => {
    if (previous) {
      await serviceOf(container).updateAddonTemplates(previous)
    }
  }
)

/** A template's product links, for the delete to dismiss (Medusa's step puts them back). */
export const addonTemplateLinksStep = createStep(
  "addon-templates-links",
  async (id: string, { container }) => {
    // Unknown: 404 before anything changes
    await serviceOf(container).retrieveAddonTemplate(id)
    const links = await productLinksOf(container, [id])
    return new StepResponse(
      links.map((link) => ({
        [Modules.PRODUCT]: { product_id: link.product_id },
        [PRODUCT_ATTRIBUTES_MODULE]: { addon_template_id: link.addon_template_id },
      }))
    )
  }
)

interface Carried {
  id: string
  addon_template_ids: string[]
}

/** The template taken out of every attribute template that carries it. */
export const uncarryAddonTemplateStep = createStep(
  "addon-templates-uncarry",
  async (id: string, { container }) => {
    const carriers = (await attributeTemplateCarries(container)).filter((row) =>
      row.addon_template_ids.includes(id)
    )
    if (carriers.length > 0) {
      await serviceOf(container).updateAttributeTemplates(
        carriers.map((row) => ({
          id: row.id,
          addon_template_ids: idsColumn(row.addon_template_ids.filter((each) => each !== id)),
        }))
      )
    }
    return new StepResponse(carriers.length, carriers)
  },
  async (carriers: Carried[] | undefined, { container }) => {
    if (carriers && carriers.length > 0) {
      await serviceOf(container).updateAttributeTemplates(
        carriers.map((row) => ({
          id: row.id,
          addon_template_ids: idsColumn(row.addon_template_ids),
        }))
      )
    }
  }
)

export const deleteAddonTemplateStep = createStep(
  "addon-templates-delete",
  async (id: string, { container }) => {
    await serviceOf(container).softDeleteAddonTemplates([id])
    return new StepResponse({ id }, id)
  },
  async (id: string | undefined, { container }) => {
    if (id) {
      await serviceOf(container).restoreAddonTemplates([id])
    }
  }
)

export interface CarryInput {
  attribute_template_id: string
  addon_template_ids: string[]
}

/**
 * The add-on templates an attribute template carries, in order: its
 * products get them. Unknown ids are refused; adding needs the flag and
 * keeps every product of the attribute template within five add-ons.
 */
export const carryAddonTemplatesStep = createStep(
  "addon-templates-carry",
  async (input: CarryInput, { container }) => {
    const service = serviceOf(container)
    const current = await service.retrieveAttributeTemplate(input.attribute_template_id)
    const before = Array.isArray(current.addon_template_ids)
      ? (current.addon_template_ids as unknown[]).filter(
          (id): id is string => typeof id === "string"
        )
      : []
    const templates = await addonTemplatesByIds(container, input.addon_template_ids)
    if (templates.size !== new Set(input.addon_template_ids).size) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "addon_templates.unknown")
    }
    const added = input.addon_template_ids.some((id) => !before.includes(id))
    if (added) {
      await requireAddonsFlag(container)
      const carried = input.addon_template_ids.flatMap((id) => {
        const template = templates.get(id)
        return template ? [template] : []
      })
      await checkAddonLimit(
        container,
        await productsOfAttributeTemplates(container, [input.attribute_template_id]),
        (sources) => ({ ...sources, carried }),
        "addon_templates.too_many"
      )
    }
    await service.updateAttributeTemplates({
      id: input.attribute_template_id,
      addon_template_ids: idsColumn(input.addon_template_ids),
    })
    return new StepResponse(input.addon_template_ids, {
      id: input.attribute_template_id,
      addon_template_ids: before,
    })
  },
  async (previous: Carried | undefined, { container }) => {
    if (previous) {
      await serviceOf(container).updateAttributeTemplates({
        id: previous.id,
        addon_template_ids: idsColumn(previous.addon_template_ids),
      })
    }
  }
)
