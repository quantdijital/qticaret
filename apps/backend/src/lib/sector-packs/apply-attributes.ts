import { MedusaError } from "@medusajs/framework/utils"
import { packItemKey } from "@qticaret/sector-packs"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import { createAttributeTemplateWorkflow } from "../../workflows/product-attributes/templates"
import { addAttributeDefinitionsWorkflow } from "../../workflows/sector-packs/add-attribute-definitions"
import type { PackTemplate } from "./check"
import type { ApplyContext } from "./context"

type Service = ProductAttributesModuleService

async function templateOf(service: Service, id: string) {
  try {
    return await service.retrieveAttributeTemplate(id, { select: ["id"] })
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND) {
      return null
    }
    throw error
  }
}

/**
 * A template never offered here: made with all its attributes, through the
 * panel's own workflow; a template of that handle already here is the
 * shop's and is left as it is, with every attribute of the pack's.
 */
async function offerTemplate(context: ApplyContext, service: Service, template: PackTemplate) {
  const [existing] = await service.listAttributeTemplates(
    { handle: template.handle },
    { relations: ["definitions"], take: 1 }
  )
  if (existing) {
    const have = new Map(existing.definitions.map((definition) => [definition.key, definition.id]))
    await context.record({
      key: packItemKey.template(template.handle),
      kind: "attribute_template",
      outcome: "kept",
      record_id: existing.id,
    })
    for (const definition of template.definitions) {
      const id = have.get(definition.key) ?? null
      await context.record({
        key: packItemKey.attribute(template.handle, definition.key),
        kind: "attribute",
        outcome: id ? "kept" : "skipped",
        record_id: id,
      })
    }
    return
  }
  const { result } = await createAttributeTemplateWorkflow(context.container).run({
    input: template,
  })
  const made = await service.listAttributeDefinitions(
    { template_id: result.id },
    { select: ["id", "key"], take: null }
  )
  await context.record({
    key: packItemKey.template(template.handle),
    kind: "attribute_template",
    outcome: "added",
    record_id: result.id,
  })
  for (const definition of made) {
    await context.record({
      key: packItemKey.attribute(template.handle, definition.key),
      kind: "attribute",
      outcome: "added",
      record_id: definition.id,
    })
  }
}

/**
 * Attributes a newer version brought to a template offered before: added
 * to it if the pack made it and it is still here; the shop's own template,
 * or one the shop removed, gets none.
 */
async function offerNewAttributes(context: ApplyContext, service: Service, template: PackTemplate) {
  const pending = template.definitions.filter(
    (definition) => !context.offered.has(packItemKey.attribute(template.handle, definition.key))
  )
  if (pending.length === 0) {
    return
  }
  const prior = context.offered.get(packItemKey.template(template.handle))
  const target =
    prior?.outcome === "added" && prior.record_id
      ? await templateOf(service, prior.record_id)
      : null
  if (!target) {
    for (const definition of pending) {
      await context.record({
        key: packItemKey.attribute(template.handle, definition.key),
        kind: "attribute",
        outcome: "skipped",
        record_id: null,
      })
    }
    return
  }
  const { result } = await addAttributeDefinitionsWorkflow(context.container).run({
    input: { template_id: target.id, groups: template.groups ?? [], definitions: pending },
  })
  for (const [outcome, list] of [
    ["added", result.added],
    ["kept", result.kept],
  ] as const) {
    for (const definition of list) {
      await context.record({
        key: packItemKey.attribute(template.handle, definition.key),
        kind: "attribute",
        outcome,
        record_id: definition.id,
      })
    }
  }
}

/** The pack's attribute templates (adr/0013): new ones made, new attributes added, nothing changed. */
export async function applyAttributeTemplates(context: ApplyContext): Promise<void> {
  const service = context.container.resolve<Service>(PRODUCT_ATTRIBUTES_MODULE)
  for (const template of context.pack.attribute_templates) {
    if (context.offered.has(packItemKey.template(template.handle))) {
      await offerNewAttributes(context, service, template)
    } else {
      await offerTemplate(context, service, template)
    }
  }
}
