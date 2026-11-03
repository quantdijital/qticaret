import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import { synonymTerms } from "../../lib/search"
import { SEARCH_INDEX_MODULE } from "../../modules/search-index"
import type SearchIndexModuleService from "../../modules/search-index/service"

/**
 * The shop's synonym groups (adr/0056): words shoppers use for one
 * another, both ways. A group's terms are checked and kept as
 * `synonymTerms` says (lib/search); a shop keeps at most
 * MAX_SYNONYM_GROUPS. Every save drops the search's cached groups in
 * every process; a step undone writes the group back as it was.
 */

export const MAX_SYNONYM_GROUPS = 1000

const SYNONYMS_LOCK = { key: "search:synonyms", timeout: 10, ttl: 30 }

const service = (container: MedusaContainer) =>
  container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)

export interface SaveSynonymInput {
  /** The group to change; none makes a new one. */
  id?: string
  terms: string[]
}

type SaveUndo = { created: string } | { id: string; terms: string[] }

export interface SavedSynonym {
  id: string
  terms: string[]
}

export const saveSynonymStep = createStep(
  "search-index-write-synonym",
  async (input: SaveSynonymInput, { container }) => {
    const index = service(container)
    const terms = synonymTerms(input.terms)
    if (input.id) {
      const [current] = await index.listSearchSynonyms({ id: input.id }, { take: 1 })
      if (!current) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "search.synonym_unknown")
      }
      const saved = await index.updateSearchSynonyms({ id: input.id, terms })
      await index.invalidateSynonyms()
      const undo: SaveUndo = { id: input.id, terms: current.terms }
      return new StepResponse<SavedSynonym, SaveUndo>({ id: saved.id, terms: saved.terms }, undo)
    }
    const [, count] = await index.listAndCountSearchSynonyms({}, { take: 1 })
    if (count >= MAX_SYNONYM_GROUPS) {
      throw new ValidationError("search.synonyms_too_many", { field: "terms" })
    }
    const saved = await index.createSearchSynonyms({ terms })
    await index.invalidateSynonyms()
    const undo: SaveUndo = { created: saved.id }
    return new StepResponse<SavedSynonym, SaveUndo>({ id: saved.id, terms: saved.terms }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const index = service(container)
    if ("created" in undo) {
      await index.deleteSearchSynonyms(undo.created)
    } else {
      await index.updateSearchSynonyms({ id: undo.id, terms: undo.terms })
    }
    await index.invalidateSynonyms()
  }
)

export const deleteSynonymStep = createStep(
  "search-index-remove-synonym",
  async (id: string, { container }) => {
    const index = service(container)
    const [current] = await index.listSearchSynonyms({ id }, { take: 1 })
    if (!current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "search.synonym_unknown")
    }
    await index.softDeleteSearchSynonyms(id)
    await index.invalidateSynonyms()
    return new StepResponse(id, id)
  },
  async (id, { container }) => {
    if (id) {
      await service(container).restoreSearchSynonyms(id)
      await service(container).invalidateSynonyms()
    }
  }
)

/** Creates or changes a synonym group; one save at a time (the shop's group limit). */
export const saveSynonymWorkflow = createWorkflow(
  "search-index-save-synonym",
  (input: SaveSynonymInput) => {
    acquireLockStep(SYNONYMS_LOCK)
    const saved = saveSynonymStep(input)
    releaseLockStep({ key: SYNONYMS_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

export const deleteSynonymWorkflow = createWorkflow(
  "search-index-delete-synonym",
  (id: string) => new WorkflowResponse(deleteSynonymStep(id))
)
