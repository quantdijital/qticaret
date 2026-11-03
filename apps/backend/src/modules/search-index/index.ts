import { Module } from "@medusajs/framework/utils"
import SearchIndexModuleService from "./service"

/**
 * Site search and listings in PostgreSQL full text (adr/0056): a row per
 * product with weighted `tsvector`s (Turkish stems and plain words), the
 * facts listings filter and sort by, a word dictionary for typos, the
 * shop's synonym groups, and the queue of products to index again.
 */
export const SEARCH_INDEX_MODULE = "search_index"

export default Module(SEARCH_INDEX_MODULE, { service: SearchIndexModuleService })
