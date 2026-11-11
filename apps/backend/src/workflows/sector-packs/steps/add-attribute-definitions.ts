import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../../modules/product-attributes"
import type ProductAttributesModuleService from "../../../modules/product-attributes/service"
import { groupsOf } from "../../../modules/product-attributes/validation"
import type {
  AttributeGroup,
  DefinitionInput,
} from "../../../modules/product-attributes/validation"
import {
  attributeConflict,
  definitionRow,
  groupsColumn,
} from "../../product-attributes/steps/create-attribute-template"

export interface AddAttributeDefinitionsInput {
  template_id: string
  /** The pack's sections: one a new attribute names and the template lacks is added. */
  groups: AttributeGroup[]
  definitions: DefinitionInput[]
}

export interface AddedDefinitions {
  /** Made now, by key. */
  added: { key: string; id: string }[]
  /** The template already had an attribute of that key: left as it is. */
  kept: { key: string; id: string }[]
}

interface Undo {
  template_id: string
  groups: Record<string, unknown> | null
  created: string[]
}

/**
 * A newer pack version's attributes added to a template the pack made
 * before (adr/0061 C12): only keys the template does not have, never a
 * change to one it has. An added attribute is never required (a required
 * one would stop the template's products from saving until filled); the
 * shop may make it so. A section it names that the template lacks is
 * added from the pack, after the template's own.
 */
export const addAttributeDefinitionsStep = createStep(
  "sector-packs-add-attribute-definitions",
  async (input: AddAttributeDefinitionsInput, { container }) => {
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    const template = await service.retrieveAttributeTemplate(input.template_id, {
      relations: ["definitions"],
    })
    const have = new Map(template.definitions.map((definition) => [definition.key, definition.id]))
    const kept = input.definitions.flatMap((definition) => {
      const id = have.get(definition.key)
      return id ? [{ key: definition.key, id }] : []
    })
    const fresh = input.definitions.filter((definition) => !have.has(definition.key))
    const before = groupsOf(template.groups)
    const groups = [...before]
    for (const definition of fresh) {
      const key = definition.group
      const offered = input.groups.find((group) => group.key === key)
      if (key && offered && !groups.some((group) => group.key === key)) {
        groups.push({ ...offered, rank: groups.length })
      }
    }
    const undo: Undo = {
      template_id: template.id,
      groups: groupsColumn(before),
      created: [],
    }
    try {
      if (groups.length !== before.length) {
        await service.updateAttributeTemplates({ id: template.id, groups: groupsColumn(groups) })
      }
      const known = new Set(groups.map((group) => group.key))
      const made =
        fresh.length > 0
          ? await service.createAttributeDefinitions(
              fresh.map((definition) =>
                definitionRow(
                  {
                    ...definition,
                    is_required: false,
                    // A section the template still lacks: none
                    group:
                      definition.group && known.has(definition.group) ? definition.group : null,
                  },
                  template.id
                )
              )
            )
          : []
      undo.created = made.map((definition) => definition.id)
      const added = made.map((definition) => ({ key: definition.key, id: definition.id }))
      return new StepResponse<AddedDefinitions, Undo>({ added, kept }, undo)
    } catch (error) {
      await service.updateAttributeTemplates({ id: template.id, groups: undo.groups })
      throw attributeConflict(error)
    }
  },
  async (undo: Undo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    if (undo.created.length > 0) {
      await service.deleteAttributeDefinitions(undo.created)
    }
    await service.updateAttributeTemplates({ id: undo.template_id, groups: undo.groups })
  }
)
