import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEARCH_INDEX_MODULE } from "../../../modules/search-index"
import type SearchIndexModuleService from "../../../modules/search-index/service"
import type { DocumentInput, StoredDocument } from "../../../modules/search-index/types"

export interface WriteSearchDocumentsInput {
  documents: DocumentInput[]
  /** Products gone from the catalogue: their rows go. */
  gone: string[]
}

interface Undo {
  /** The rows as they were, to write back. */
  previous: StoredDocument[]
  /** Products that had no row: theirs are taken out. */
  added: string[]
}

/**
 * Writes the products' rows and takes out the gone ones (adr/0056). Undone
 * by writing back the rows as they were and taking out the new ones: the
 * index is a copy of the catalogue, and a failed run leaves it as before.
 */
export const writeSearchDocumentsStep = createStep(
  "search-index-write-documents",
  async (input: WriteSearchDocumentsInput, { container }) => {
    const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
    const ids = [...input.documents.map((doc) => doc.product_id), ...input.gone]
    const previous = await index.readDocuments(ids)
    const had = new Set(previous.map((doc) => doc.product_id))
    await index.writeDocuments(input.documents)
    await index.removeDocuments(input.gone)
    const undo: Undo = {
      previous,
      added: input.documents.map((doc) => doc.product_id).filter((id) => !had.has(id)),
    }
    return new StepResponse({ written: input.documents.length, removed: input.gone.length }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const index = container.resolve<SearchIndexModuleService>(SEARCH_INDEX_MODULE)
    await index.removeDocuments(undo.added)
    await index.writeDocuments(undo.previous)
  }
)
